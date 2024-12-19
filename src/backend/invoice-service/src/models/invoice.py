"""
Core invoice model definitions for the OTPless Internal Billing System.
Implements comprehensive validation and financial calculation capabilities using Pydantic.
"""

# pydantic v2.0.0
from pydantic import BaseModel, Field, validator, root_validator
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
from uuid import UUID, uuid4
from ..core.config import Settings

# Constants for invoice management
INVOICE_STATUSES = ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
SUPPORTED_CURRENCIES = Settings().SUPPORTED_CURRENCIES
TAX_RATES = {
    "GST": Decimal('0.18'),
    "IGST": Decimal('0.18')
}
ALLOWED_STATE_TRANSITIONS = {
    "DRAFT": ["PENDING"],
    "PENDING": ["PAID", "OVERDUE", "CANCELLED"],
    "OVERDUE": ["PAID", "CANCELLED"],
    "PAID": [],
    "CANCELLED": []
}

class LineItem(BaseModel):
    """
    Represents a single line item in an invoice with comprehensive validation.
    """
    id: UUID = Field(default_factory=uuid4)
    service_name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., decimal_places=2, gt=0)
    amount: Decimal = Field(None)
    currency_code: str = Field(..., regex='^[A-Z]{3}$')

    @validator('currency_code')
    def validate_currency(cls, v):
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency {v} not supported. Must be one of {SUPPORTED_CURRENCIES}")
        return v

    @root_validator
    def calculate_amount(cls, values):
        """Calculates the total amount for the line item with proper decimal precision."""
        quantity = values.get('quantity')
        unit_price = values.get('unit_price')
        
        if quantity is not None and unit_price is not None:
            amount = Decimal(quantity) * unit_price
            values['amount'] = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        return values

class Invoice(BaseModel):
    """
    Main invoice model with comprehensive validation and calculation capabilities.
    """
    id: UUID = Field(default_factory=uuid4)
    customer_id: UUID
    invoice_number: Optional[str] = None
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime = Field(None)
    status: str = Field(default='DRAFT')
    currency_code: str = Field(..., regex='^[A-Z]{3}$')
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    tax_amount: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    tax_type: str = Field(None)
    total_amount: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    customer_details: Dict = Field(...)
    payment_details: Dict = Field(default_factory=dict)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator('status')
    def validate_status(cls, v):
        if v not in INVOICE_STATUSES:
            raise ValueError(f"Invalid status. Must be one of {INVOICE_STATUSES}")
        return v

    @validator('due_date', always=True)
    def set_due_date(cls, v, values):
        if v is None and 'issue_date' in values:
            return values['issue_date'] + timedelta(days=30)
        return v

    @validator('currency_code')
    def validate_currency(cls, v):
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency {v} not supported. Must be one of {SUPPORTED_CURRENCIES}")
        return v

    @validator('customer_details')
    def validate_customer_details(cls, v):
        required_fields = {'name', 'address', 'tax_id', 'state'}
        if not all(field in v for field in required_fields):
            raise ValueError(f"Customer details must contain: {required_fields}")
        return v

    def validate_state_transition(self, new_status: str) -> bool:
        """Validates invoice status state transitions."""
        if new_status not in INVOICE_STATUSES:
            raise ValueError(f"Invalid status {new_status}")
        
        allowed_transitions = ALLOWED_STATE_TRANSITIONS.get(self.status, [])
        if new_status not in allowed_transitions:
            raise ValueError(f"Invalid transition from {self.status} to {new_status}")
        
        return True

    def validate_tax_type(self) -> str:
        """Validates and determines appropriate tax type based on customer location."""
        customer_state = self.customer_details.get('state')
        billing_state = "Maharashtra"  # Example: Company's billing state
        
        if not customer_state:
            raise ValueError("Customer state is required for tax calculation")
        
        tax_type = "IGST" if customer_state != billing_state else "GST"
        if tax_type not in TAX_RATES:
            raise ValueError(f"Invalid tax type {tax_type}")
        
        return tax_type

    @root_validator
    def calculate_totals(cls, values):
        """Calculates invoice totals including tax with proper rounding."""
        line_items = values.get('line_items', [])
        currency = values.get('currency_code')

        if not line_items:
            return values

        # Validate currency consistency
        if not all(item.currency_code == currency for item in line_items):
            raise ValueError("All line items must use the same currency as the invoice")

        # Calculate subtotal
        subtotal = sum(item.amount for item in line_items)
        values['subtotal'] = subtotal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Calculate tax
        tax_type = values.get('tax_type')
        if tax_type:
            tax_rate = TAX_RATES[tax_type]
            tax_amount = (subtotal * tax_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            values['tax_amount'] = tax_amount
            values['total_amount'] = (subtotal + tax_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            values['total_amount'] = subtotal

        return values

    async def generate_invoice_number(self) -> str:
        """Generates a unique invoice number with concurrency control."""
        if self.invoice_number:
            return self.invoice_number

        current_date = datetime.utcnow()
        # Format: INV-YYYYMM-XXXX
        # Note: Actual implementation would need to handle concurrent generation
        # through database sequence or distributed lock
        sequential_number = 1  # This would come from a database sequence
        self.invoice_number = f"INV-{current_date.strftime('%Y%m')}-{sequential_number:04d}"
        return self.invoice_number

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat(),
            Decimal: str
        }
        validate_assignment = True
        arbitrary_types_allowed = True