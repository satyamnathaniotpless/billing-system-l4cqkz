"""
PDF Generator utility for creating professional invoice PDFs with comprehensive formatting,
security features, and proper resource management.

Version: 1.0.0
"""

# reportlab v4.0.4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import Table, TableStyle, Paragraph, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

# Pillow v10.0.0
from PIL import Image as PILImage

# Built-in imports
from tempfile import NamedTemporaryFile
from datetime import datetime
from decimal import Decimal
from contextlib import contextmanager
import os
import logging

# Internal imports
from ..models.invoice import Invoice, LineItem
from ..core.config import Settings

# Constants
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 50
LOGO_MAX_WIDTH = 150
LOGO_MAX_HEIGHT = 80

CURRENCY_SYMBOLS = {
    "USD": "$",
    "INR": "₹",
    "IDR": "Rp"
}

TAX_LABELS = {
    "GST": "GST (18%)",
    "IGST": "IGST (18%)"
}

logger = logging.getLogger(__name__)

class PDFGenerator:
    """
    Professional PDF invoice generator with comprehensive formatting and security features.
    Implements secure resource handling and proper cleanup.
    """
    
    def __init__(self, settings: Settings, template_config: dict = None, is_draft: bool = False):
        """
        Initialize PDF generator with configuration and styling.
        
        Args:
            settings: Application settings
            template_config: Custom template configuration
            is_draft: Whether to add draft watermark
        """
        self.settings = settings
        self.template_config = template_config or {}
        self.is_draft = is_draft
        self.styles = self._initialize_styles()
        self.temp_path = None
        self.canvas = None

    def _initialize_styles(self) -> dict:
        """Initialize document styles and formatting."""
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='InvoiceHeader',
            fontSize=24,
            spaceAfter=30,
            alignment=TA_LEFT
        ))
        styles.add(ParagraphStyle(
            name='CompanyDetails',
            fontSize=10,
            spaceAfter=20
        ))
        styles.add(ParagraphStyle(
            name='TableHeader',
            fontSize=12,
            textColor=colors.white,
            alignment=TA_CENTER
        ))
        return styles

    @contextmanager
    def _create_pdf_context(self):
        """Context manager for secure PDF file handling with proper cleanup."""
        try:
            with NamedTemporaryFile(prefix='otpless_invoice_', suffix='.pdf', delete=False) as temp_file:
                self.temp_path = temp_file.name
                self.canvas = canvas.Canvas(self.temp_path, pagesize=A4)
                yield
                self.canvas.save()
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}")
            if self.temp_path and os.path.exists(self.temp_path):
                os.unlink(self.temp_path)
            raise
    
    def generate_pdf(self, invoice: Invoice) -> str:
        """
        Generate a complete PDF invoice with proper formatting and security measures.
        
        Args:
            invoice: Invoice model instance
            
        Returns:
            str: Path to generated PDF file
        """
        with self._create_pdf_context():
            # Add company branding
            self._add_header(invoice)
            
            # Add invoice details
            self._add_invoice_details(invoice)
            
            # Add line items
            self._add_line_items(invoice.line_items)
            
            # Add totals and tax details
            self._add_totals(invoice)
            
            # Add footer with payment details
            self._add_footer(invoice)
            
            # Add draft watermark if applicable
            if self.is_draft:
                self._add_draft_watermark()
            
            return self.temp_path

    def _add_header(self, invoice: Invoice):
        """Add company branding and invoice header."""
        # Add logo if configured
        if 'company_logo' in self.template_config:
            self._add_logo(self.template_config['company_logo'])
        
        # Add company details
        company_details = self.template_config.get('company_details', {})
        company_text = [
            Paragraph(company_details.get('name', 'OTPless'), self.styles['InvoiceHeader']),
            Paragraph(company_details.get('address', ''), self.styles['CompanyDetails']),
            Paragraph(f"Tax ID: {company_details.get('tax_id', '')}", self.styles['CompanyDetails'])
        ]
        
        for i, text in enumerate(company_text):
            text.wrapOn(self.canvas, PAGE_WIDTH - 2*MARGIN, PAGE_HEIGHT)
            text.drawOn(self.canvas, MARGIN, PAGE_HEIGHT - MARGIN - (i * 20))

    def _add_invoice_details(self, invoice: Invoice):
        """Add invoice metadata and customer details."""
        y_position = PAGE_HEIGHT - 200
        
        # Invoice number and dates
        self.canvas.setFont("Helvetica-Bold", 12)
        self.canvas.drawString(MARGIN, y_position, f"Invoice Number: {invoice.invoice_number}")
        self.canvas.drawString(MARGIN, y_position - 20, 
                             f"Issue Date: {invoice.issue_date.strftime('%d %b %Y')}")
        self.canvas.drawString(MARGIN, y_position - 40, 
                             f"Due Date: {invoice.due_date.strftime('%d %b %Y')}")
        
        # Customer details
        y_position -= 80
        self.canvas.setFont("Helvetica-Bold", 12)
        self.canvas.drawString(MARGIN, y_position, "Bill To:")
        self.canvas.setFont("Helvetica", 10)
        
        customer = invoice.customer_details
        details = [
            customer.get('name', ''),
            customer.get('address', ''),
            f"Tax ID: {customer.get('tax_id', '')}",
            f"State: {customer.get('state', '')}"
        ]
        
        for i, detail in enumerate(details):
            self.canvas.drawString(MARGIN, y_position - ((i + 1) * 15), detail)

    def _add_line_items(self, line_items: list[LineItem]):
        """Generate formatted line items table."""
        data = [['Description', 'Quantity', 'Unit Price', 'Amount']]
        
        for item in line_items:
            currency_symbol = CURRENCY_SYMBOLS.get(item.currency_code, '')
            data.append([
                item.service_name,
                str(item.quantity),
                f"{currency_symbol}{item.unit_price:,.2f}",
                f"{currency_symbol}{item.amount:,.2f}"
            ])
        
        table = Table(data, colWidths=[250, 70, 100, 100])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        table.wrapOn(self.canvas, PAGE_WIDTH - 2*MARGIN, PAGE_HEIGHT)
        table.drawOn(self.canvas, MARGIN, PAGE_HEIGHT - 450)

    def _add_totals(self, invoice: Invoice):
        """Add subtotal, tax calculations, and total amount."""
        y_position = PAGE_HEIGHT - 550
        currency_symbol = CURRENCY_SYMBOLS.get(invoice.currency_code, '')
        
        # Subtotal
        self.canvas.setFont("Helvetica", 10)
        self.canvas.drawString(PAGE_WIDTH - 200, y_position, "Subtotal:")
        self.canvas.drawRightString(
            PAGE_WIDTH - MARGIN, y_position,
            f"{currency_symbol}{invoice.subtotal:,.2f}"
        )
        
        # Tax
        if invoice.tax_type:
            y_position -= 20
            tax_label = TAX_LABELS.get(invoice.tax_type, invoice.tax_type)
            self.canvas.drawString(PAGE_WIDTH - 200, y_position, tax_label)
            self.canvas.drawRightString(
                PAGE_WIDTH - MARGIN, y_position,
                f"{currency_symbol}{invoice.tax_amount:,.2f}"
            )
        
        # Total
        y_position -= 30
        self.canvas.setFont("Helvetica-Bold", 12)
        self.canvas.drawString(PAGE_WIDTH - 200, y_position, "Total:")
        self.canvas.drawRightString(
            PAGE_WIDTH - MARGIN, y_position,
            f"{currency_symbol}{invoice.total_amount:,.2f}"
        )

    def _add_footer(self, invoice: Invoice):
        """Add payment details and terms."""
        y_position = 100
        
        self.canvas.setFont("Helvetica-Bold", 10)
        self.canvas.drawString(MARGIN, y_position, "Payment Details:")
        
        self.canvas.setFont("Helvetica", 10)
        payment_details = invoice.payment_details
        for i, (key, value) in enumerate(payment_details.items()):
            self.canvas.drawString(MARGIN, y_position - ((i + 1) * 15), f"{key}: {value}")

    def _add_draft_watermark(self):
        """Add draft watermark if document is not final."""
        self.canvas.saveState()
        self.canvas.setFont("Helvetica", 70)
        self.canvas.setFillColor(colors.grey)
        self.canvas.setFillAlpha(0.3)
        self.canvas.rotate(45)
        self.canvas.drawString(200, 0, "DRAFT")
        self.canvas.restoreState()

    def _add_logo(self, logo_path: str):
        """Add and scale company logo."""
        try:
            img = PILImage.open(logo_path)
            aspect = img.width / img.height
            
            if img.width > LOGO_MAX_WIDTH:
                width = LOGO_MAX_WIDTH
                height = width / aspect
            else:
                width = img.width
                height = img.height
                
            if height > LOGO_MAX_HEIGHT:
                height = LOGO_MAX_HEIGHT
                width = height * aspect
                
            self.canvas.drawImage(
                ImageReader(img),
                PAGE_WIDTH - MARGIN - width,
                PAGE_HEIGHT - MARGIN - height,
                width=width,
                height=height
            )
        except Exception as e:
            logger.error(f"Error adding logo: {str(e)}")