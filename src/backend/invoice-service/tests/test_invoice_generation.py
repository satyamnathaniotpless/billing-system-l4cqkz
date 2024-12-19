"""
Comprehensive test suite for invoice generation functionality in the OTPless Internal Billing System.
Tests invoice creation, PDF generation, tax calculations, and multi-currency support.

Version: 1.0.0
"""

import pytest
from pytest_mock import MockerFixture
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID
from freezegun import freeze_time

from ..models.invoice import Invoice, LineItem
from ..services.invoice_generator import InvoiceGenerator
from ..utils.pdf_generator import PDFGenerator
from ..core.config import Settings

# Test Constants
TEST_CUSTOMER_ID = UUID('12345678-1234-5678-1234-567812345678')
TEST_DATE = datetime(2023, 10, 1, 12, 0, 0)

TEST_INVOICE_DATA = {
    'customer_id': TEST_CUSTOMER_ID,
    'currency_code': 'USD',
    'customer_details': {
        'name': 'Test Corp',
        'address': '123 Test St, Test City',
        'tax_id': 'TEST123456',
        'state': 'Maharashtra'
    },
    'line_items': [
        {
            'service_name': 'SMS Authentication',
            'description': 'SMS OTP Service',
            'quantity': 1000,
            'unit_price': Decimal('0.01'),
            'currency_code': 'USD'
        }
    ]
}

TAX_SCENARIOS = [
    {
        'name': 'domestic_gst',
        'state': 'Maharashtra',
        'expected_type': 'GST',
        'expected_rate': Decimal('0.18')
    },
    {
        'name': 'interstate_igst',
        'state': 'Karnataka',
        'expected_type': 'IGST',
        'expected_rate': Decimal('0.18')
    }
]

CURRENCY_FORMATS = [
    ('USD', '$', 2),
    ('INR', '₹', 2),
    ('IDR', 'Rp', 0)
]

@pytest.mark.asyncio
class TestInvoiceGeneration:
    """Test suite for invoice generation functionality."""

    async def setup_method(self):
        """Setup test environment before each test."""
        # Initialize test settings
        self.settings = Settings(
            DATABASE_URL="postgresql://test:test@localhost:5432/test_db",
            JWT_SECRET_KEY="test_secret_key_32_characters_long",
            S3_BUCKET_NAME="test-invoice-bucket",
            AWS_ACCESS_KEY_ID="test_key",
            AWS_SECRET_ACCESS_KEY="test_secret"
        )

        # Initialize services
        self.invoice_generator = InvoiceGenerator(self.settings)
        self.pdf_generator = PDFGenerator(self.settings)

    @freeze_time(TEST_DATE)
    async def test_invoice_creation(self, mocker: MockerFixture):
        """Test basic invoice creation with line items."""
        # Mock S3 client
        mock_s3 = mocker.patch.object(self.invoice_generator, 's3_client')
        
        # Generate invoice
        invoice = self.invoice_generator.generate_invoice(TEST_INVOICE_DATA)
        
        # Validate basic invoice properties
        assert isinstance(invoice, Invoice)
        assert invoice.customer_id == TEST_CUSTOMER_ID
        assert invoice.currency_code == 'USD'
        assert invoice.status == 'DRAFT'
        
        # Validate invoice number format
        assert invoice.invoice_number.startswith('INV-')
        assert TEST_DATE.strftime('%Y%m') in invoice.invoice_number
        
        # Validate line item calculations
        assert len(invoice.line_items) == 1
        line_item = invoice.line_items[0]
        assert line_item.amount == Decimal('10.00')  # 1000 * 0.01
        
        # Validate totals
        assert invoice.subtotal == Decimal('10.00')
        assert invoice.tax_type == 'GST'  # Maharashtra state
        assert invoice.tax_amount == Decimal('1.80')  # 18% GST
        assert invoice.total_amount == Decimal('11.80')

    async def test_pdf_generation(self, mocker: MockerFixture):
        """Test PDF document generation and storage."""
        # Mock PDF generation
        mock_pdf = mocker.patch.object(self.pdf_generator, 'generate_pdf')
        mock_pdf.return_value = '/tmp/test_invoice.pdf'
        
        # Mock S3 operations
        mock_s3 = mocker.patch.object(self.invoice_generator, 's3_client')
        mock_s3.generate_presigned_url.return_value = 'https://test-url/invoice.pdf'
        
        # Generate invoice and PDF
        invoice = self.invoice_generator.generate_invoice(TEST_INVOICE_DATA)
        pdf_url = self.invoice_generator.generate_pdf_document(invoice)
        
        # Validate PDF generation
        mock_pdf.assert_called_once()
        assert pdf_url == 'https://test-url/invoice.pdf'
        
        # Verify S3 upload parameters
        mock_s3.upload_fileobj.assert_called_once()
        upload_args = mock_s3.upload_fileobj.call_args[1]['ExtraArgs']
        assert upload_args['ContentType'] == 'application/pdf'
        assert upload_args['ServerSideEncryption'] == 'AES-256-GCM'
        assert 'invoice_number' in upload_args['Metadata']

    @pytest.mark.parametrize('tax_scenario', TAX_SCENARIOS)
    async def test_tax_calculations(self, tax_scenario: dict):
        """Test tax calculations for different scenarios."""
        # Modify test data for tax scenario
        test_data = TEST_INVOICE_DATA.copy()
        test_data['customer_details'] = {
            **test_data['customer_details'],
            'state': tax_scenario['state']
        }
        
        # Generate invoice
        invoice = self.invoice_generator.generate_invoice(test_data)
        
        # Validate tax calculations
        assert invoice.tax_type == tax_scenario['expected_type']
        expected_tax = invoice.subtotal * tax_scenario['expected_rate']
        assert invoice.tax_amount == expected_tax.quantize(Decimal('0.01'))
        assert invoice.total_amount == (invoice.subtotal + invoice.tax_amount)

    @pytest.mark.parametrize('currency,symbol,decimals', CURRENCY_FORMATS)
    async def test_multi_currency(self, currency: str, symbol: str, decimals: int):
        """Test multi-currency invoice generation."""
        # Modify test data for currency
        test_data = TEST_INVOICE_DATA.copy()
        test_data['currency_code'] = currency
        test_data['line_items'][0]['currency_code'] = currency
        
        # Generate invoice
        invoice = self.invoice_generator.generate_invoice(test_data)
        
        # Validate currency handling
        assert invoice.currency_code == currency
        assert all(item.currency_code == currency for item in invoice.line_items)
        
        # Validate amount formatting
        amount_str = str(invoice.total_amount)
        decimal_places = len(amount_str.split('.')[-1]) if '.' in amount_str else 0
        assert decimal_places <= decimals

    async def test_invoice_validation_errors(self):
        """Test invoice validation error handling."""
        # Test missing required fields
        invalid_data = TEST_INVOICE_DATA.copy()
        del invalid_data['customer_details']['tax_id']
        
        with pytest.raises(ValueError) as exc_info:
            self.invoice_generator.generate_invoice(invalid_data)
        assert "Customer details must contain" in str(exc_info.value)
        
        # Test currency mismatch
        invalid_data = TEST_INVOICE_DATA.copy()
        invalid_data['line_items'][0]['currency_code'] = 'INR'
        
        with pytest.raises(ValueError) as exc_info:
            self.invoice_generator.generate_invoice(invalid_data)
        assert "currency does not match" in str(exc_info.value)

    @freeze_time(TEST_DATE)
    async def test_invoice_number_generation(self):
        """Test invoice number generation format and uniqueness."""
        invoices = []
        for _ in range(3):
            invoice = self.invoice_generator.generate_invoice(TEST_INVOICE_DATA)
            invoices.append(invoice)
        
        # Validate format
        for invoice in invoices:
            assert invoice.invoice_number.startswith('INV-')
            assert TEST_DATE.strftime('%Y%m') in invoice.invoice_number
        
        # Validate uniqueness
        invoice_numbers = [inv.invoice_number for inv in invoices]
        assert len(set(invoice_numbers)) == len(invoices)

    async def test_performance_large_invoice(self):
        """Test performance with large number of line items."""
        # Create test data with 100 line items
        large_test_data = TEST_INVOICE_DATA.copy()
        large_test_data['line_items'] = [
            TEST_INVOICE_DATA['line_items'][0].copy() for _ in range(100)
        ]
        
        start_time = datetime.now()
        invoice = self.invoice_generator.generate_invoice(large_test_data)
        generation_time = datetime.now() - start_time
        
        # Validate performance
        assert generation_time.total_seconds() < 1.0  # Should complete within 1 second
        assert len(invoice.line_items) == 100
        assert invoice.total_amount == Decimal('1180.00')  # 100 * (10 + 1.80)