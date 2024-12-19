"""
Invoice Generator Service for OTPless Internal Billing System.
Handles secure invoice generation, calculations, and PDF document creation.

Version: 1.0.0
"""

import boto3
from botocore.config import Config
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional
import uuid
import logging
from cryptography.fernet import Fernet

from ..models.invoice import Invoice, LineItem
from ..utils.pdf_generator import PDFGenerator
from ..core.config import Settings

# Constants
DOCUMENT_CONTENT_TYPE = 'application/pdf'
STORAGE_PREFIX = 'invoices/'
MAX_RETRY_ATTEMPTS = 3
ENCRYPTION_ALGORITHM = 'AES-256-GCM'

class InvoiceGenerator:
    """
    Service class for generating and managing invoices with comprehensive security measures.
    Implements secure document generation and storage with audit logging.
    """

    def __init__(self, settings: Settings):
        """
        Initialize invoice generator with security settings and dependencies.

        Args:
            settings: Application configuration settings
        """
        self.settings = settings
        self.pdf_generator = PDFGenerator(settings)
        
        # Configure S3 client with retry logic
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY.get_secret_value(),
            region_name=settings.AWS_REGION,
            config=Config(
                retries=dict(
                    max_attempts=MAX_RETRY_ATTEMPTS,
                    mode='adaptive'
                )
            )
        )
        
        # Initialize logger
        self.logger = logging.getLogger(__name__)

    def generate_invoice(self, invoice_data: Dict) -> Invoice:
        """
        Creates a new invoice with validated calculations and proper tax handling.

        Args:
            invoice_data: Dictionary containing invoice details

        Returns:
            Invoice: Generated and validated invoice instance

        Raises:
            ValueError: If invoice data is invalid
        """
        try:
            # Create invoice instance with validation
            invoice = Invoice(**invoice_data)
            
            # Generate secure invoice number if not provided
            if not invoice.invoice_number:
                invoice.invoice_number = self._generate_invoice_number()
            
            # Validate and set tax type
            invoice.tax_type = invoice.validate_tax_type()
            
            # Validate line items and currency consistency
            self._validate_line_items(invoice)
            
            # Calculate totals with proper rounding
            self._calculate_invoice_totals(invoice)
            
            # Set initial status
            invoice.status = 'DRAFT'
            
            self.logger.info(
                f"Generated invoice {invoice.invoice_number} for customer {invoice.customer_id}"
            )
            
            return invoice
            
        except Exception as e:
            self.logger.error(f"Error generating invoice: {str(e)}")
            raise

    def generate_pdf_document(self, invoice: Invoice) -> str:
        """
        Generates a digitally signed PDF document for the invoice.

        Args:
            invoice: Validated invoice instance

        Returns:
            str: Secure URL for accessing the stored document

        Raises:
            ValueError: If invoice is incomplete
        """
        try:
            # Validate invoice completeness
            if not invoice.invoice_number or not invoice.line_items:
                raise ValueError("Invoice must be complete before generating PDF")
            
            # Generate PDF with digital signature
            pdf_path = self.pdf_generator.generate_pdf(invoice)
            
            # Store document securely
            document_url = self.store_document(pdf_path, invoice.invoice_number)
            
            self.logger.info(
                f"Generated PDF document for invoice {invoice.invoice_number}"
            )
            
            return document_url
            
        except Exception as e:
            self.logger.error(f"Error generating PDF document: {str(e)}")
            raise

    def calculate_tax(self, invoice: Invoice) -> Decimal:
        """
        Calculates appropriate tax amount with validation and precise rounding.

        Args:
            invoice: Invoice instance with line items

        Returns:
            Decimal: Calculated tax amount

        Raises:
            ValueError: If tax calculation fails
        """
        try:
            # Validate tax jurisdiction
            tax_type = invoice.validate_tax_type()
            
            # Get tax rate based on type
            tax_rates = {
                "GST": Decimal('0.18'),
                "IGST": Decimal('0.18')
            }
            tax_rate = tax_rates.get(tax_type)
            
            if not tax_rate:
                raise ValueError(f"Invalid tax type: {tax_type}")
            
            # Calculate tax with proper rounding
            tax_amount = (invoice.subtotal * tax_rate).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP
            )
            
            self.logger.info(
                f"Calculated {tax_type} for invoice {invoice.invoice_number}: {tax_amount}"
            )
            
            return tax_amount
            
        except Exception as e:
            self.logger.error(f"Error calculating tax: {str(e)}")
            raise

    def store_document(self, pdf_path: str, invoice_number: str) -> str:
        """
        Securely stores PDF document with versioning and encryption.

        Args:
            pdf_path: Path to generated PDF file
            invoice_number: Unique invoice identifier

        Returns:
            str: Secure URL for accessing the document

        Raises:
            Exception: If storage operation fails
        """
        try:
            # Generate secure storage key
            storage_key = f"{STORAGE_PREFIX}{invoice_number}/{uuid.uuid4()}.pdf"
            
            # Upload with server-side encryption
            with open(pdf_path, 'rb') as pdf_file:
                self.s3_client.upload_fileobj(
                    pdf_file,
                    self.settings.S3_BUCKET_NAME,
                    storage_key,
                    ExtraArgs={
                        'ContentType': DOCUMENT_CONTENT_TYPE,
                        'ServerSideEncryption': ENCRYPTION_ALGORITHM,
                        'Metadata': {
                            'invoice_number': invoice_number,
                            'generated_at': datetime.utcnow().isoformat()
                        }
                    }
                )
            
            # Generate secure URL with expiration
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.settings.S3_BUCKET_NAME,
                    'Key': storage_key
                },
                ExpiresIn=3600  # URL expires in 1 hour
            )
            
            self.logger.info(
                f"Stored PDF document for invoice {invoice_number}"
            )
            
            return url
            
        except Exception as e:
            self.logger.error(f"Error storing document: {str(e)}")
            raise

    def _generate_invoice_number(self) -> str:
        """
        Generates a unique invoice number with proper formatting.
        
        Returns:
            str: Formatted invoice number
        """
        prefix = self.settings.INVOICE_NUMBER_PREFIX
        timestamp = datetime.utcnow().strftime('%Y%m')
        unique_id = str(uuid.uuid4().int)[:6]
        return f"INV-{prefix}-{timestamp}-{unique_id}"

    def _validate_line_items(self, invoice: Invoice) -> None:
        """
        Validates line items for consistency and required fields.
        
        Args:
            invoice: Invoice instance to validate
            
        Raises:
            ValueError: If validation fails
        """
        if not invoice.line_items:
            raise ValueError("Invoice must have at least one line item")
            
        for item in invoice.line_items:
            if item.currency_code != invoice.currency_code:
                raise ValueError(
                    f"Line item currency {item.currency_code} does not match "
                    f"invoice currency {invoice.currency_code}"
                )

    def _calculate_invoice_totals(self, invoice: Invoice) -> None:
        """
        Calculates invoice totals with proper decimal handling.
        
        Args:
            invoice: Invoice instance to update
        """
        # Calculate subtotal
        subtotal = sum(item.amount for item in invoice.line_items)
        invoice.subtotal = subtotal.quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP
        )
        
        # Calculate tax
        invoice.tax_amount = self.calculate_tax(invoice)
        
        # Calculate total
        invoice.total_amount = (invoice.subtotal + invoice.tax_amount).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP
        )