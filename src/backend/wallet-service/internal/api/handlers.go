// Package api implements HTTP handlers for the wallet service
package api

import (
    "errors"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin"         // v1.9.1
    "github.com/google/uuid"           // v1.3.0
    "github.com/opentracing/opentracing-go" // v1.2.0
    "github.com/opentracing/opentracing-go/ext"

    "internal/models"
    "internal/service"
)

// Constants for pagination and supported currencies
const (
    defaultPageSize = 20
    maxPageSize = 100
    defaultCurrency = "USD"
)

var supportedCurrencies = []string{"USD", "INR", "IDR"}

// Response represents a standardized API response format
type Response struct {
    Status  string      `json:"status"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
    Meta    interface{} `json:"meta,omitempty"`
}

// WalletHandler handles HTTP requests for wallet operations
type WalletHandler struct {
    service   service.WalletService
    tracer    opentracing.Tracer
}

// NewWalletHandler creates a new instance of WalletHandler
func NewWalletHandler(service service.WalletService) (*WalletHandler, error) {
    if service == nil {
        return nil, errors.New("wallet service is required")
    }

    return &WalletHandler{
        service: service,
        tracer:  opentracing.GlobalTracer(),
    }, nil
}

// GetBalance handles GET /wallets/:id/balance endpoint
func (h *WalletHandler) GetBalance(c *gin.Context) {
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "WalletHandler.GetBalance")
    defer span.Finish()

    walletID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "invalid wallet ID format",
        })
        return
    }

    balance, currency, err := h.service.GetWalletBalance(ctx, walletID)
    if err != nil {
        code := http.StatusInternalServerError
        if errors.Is(err, service.ErrWalletNotFound) {
            code = http.StatusNotFound
        }
        c.JSON(code, Response{
            Status: "error",
            Error:  err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, Response{
        Status: "success",
        Data: map[string]interface{}{
            "balance":  balance,
            "currency": currency,
        },
    })
}

// ProcessTransaction handles POST /wallets/:id/transactions endpoint
func (h *WalletHandler) ProcessTransaction(c *gin.Context) {
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "WalletHandler.ProcessTransaction")
    defer span.Finish()

    walletID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "invalid wallet ID format",
        })
        return
    }

    // Validate idempotency key
    idempotencyKey := c.GetHeader("Idempotency-Key")
    if idempotencyKey == "" {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "idempotency key is required",
        })
        return
    }

    var req struct {
        Type        string  `json:"type" binding:"required"`
        Amount      float64 `json:"amount" binding:"required,gt=0"`
        Currency    string  `json:"currency" binding:"required"`
        Description string  `json:"description"`
        ReferenceID string  `json:"reference_id"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  fmt.Sprintf("invalid request format: %v", err),
        })
        return
    }

    // Validate transaction type
    var txType models.TransactionType
    switch req.Type {
    case "CREDIT":
        txType = models.TransactionTypeCredit
    case "DEBIT":
        txType = models.TransactionTypeDebit
    case "REFUND":
        txType = models.TransactionTypeRefund
    default:
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "invalid transaction type",
        })
        return
    }

    // Validate currency
    validCurrency := false
    for _, curr := range supportedCurrencies {
        if curr == req.Currency {
            validCurrency = true
            break
        }
    }
    if !validCurrency {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "unsupported currency",
        })
        return
    }

    tx := &models.Transaction{
        ID:          uuid.New(),
        WalletID:    walletID,
        Type:        txType,
        Status:      models.TransactionStatusInitiated,
        Amount:      req.Amount,
        Currency:    req.Currency,
        Description: req.Description,
        ReferenceID: req.ReferenceID,
        CreatedAt:   time.Now().UTC(),
        UpdatedAt:   time.Now().UTC(),
    }

    if err := h.service.ProcessTransaction(ctx, tx); err != nil {
        code := http.StatusInternalServerError
        switch {
        case errors.Is(err, service.ErrInsufficientBalance):
            code = http.StatusUnprocessableEntity
        case errors.Is(err, service.ErrWalletNotFound):
            code = http.StatusNotFound
        case errors.Is(err, service.ErrCurrencyMismatch):
            code = http.StatusUnprocessableEntity
        }
        c.JSON(code, Response{
            Status: "error",
            Error:  err.Error(),
        })
        return
    }

    c.JSON(http.StatusCreated, Response{
        Status: "success",
        Data:   tx,
    })
}

// GetTransactions handles GET /wallets/:id/transactions endpoint
func (h *WalletHandler) GetTransactions(c *gin.Context) {
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "WalletHandler.GetTransactions")
    defer span.Finish()

    walletID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, Response{
            Status: "error",
            Error:  "invalid wallet ID format",
        })
        return
    }

    // Parse pagination parameters
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(defaultPageSize)))
    if pageSize > maxPageSize {
        pageSize = maxPageSize
    }
    if page < 1 {
        page = 1
    }
    offset := (page - 1) * pageSize

    // Parse filter parameters
    filter := service.TransactionFilter{
        FromDate: time.Time{},
        ToDate:   time.Time{},
    }

    if fromDate := c.Query("from_date"); fromDate != "" {
        if parsed, err := time.Parse(time.RFC3339, fromDate); err == nil {
            filter.FromDate = parsed
        }
    }
    if toDate := c.Query("to_date"); toDate != "" {
        if parsed, err := time.Parse(time.RFC3339, toDate); err == nil {
            filter.ToDate = parsed
        }
    }

    transactions, total, err := h.service.GetTransactionHistory(ctx, walletID, filter, service.Pagination{
        Limit:  pageSize,
        Offset: offset,
    })
    if err != nil {
        code := http.StatusInternalServerError
        if errors.Is(err, service.ErrWalletNotFound) {
            code = http.StatusNotFound
        }
        c.JSON(code, Response{
            Status: "error",
            Error:  err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, Response{
        Status: "success",
        Data:   transactions,
        Meta: map[string]interface{}{
            "total":      total,
            "page":       page,
            "page_size":  pageSize,
            "total_pages": (total + pageSize - 1) / pageSize,
        },
    })
}