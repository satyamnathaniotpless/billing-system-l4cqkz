#!/bin/bash

#==============================================================================
# OTPless Internal Billing System - Database Backup Script
# Version: 1.0.0
# Description: Automated database backup with encryption, compression and S3 upload
#==============================================================================

set -euo pipefail
IFS=$'\n\t'

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
# Global variables from specification
readonly BACKUP_RETENTION_DAYS=30
readonly BACKUP_PREFIX="database_backups"
readonly LOG_DIR="/var/log/otpless/backups"
readonly PARALLEL_JOBS=4
readonly COMPRESSION_LEVEL=9
readonly MAX_RETRIES=3
readonly BACKUP_TIMEOUT=3600
readonly HEALTH_CHECK_TIMEOUT=300

# Dynamic configuration
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKUP_DIR="/tmp/otpless_backups/${TIMESTAMP}"
readonly LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"
readonly METRICS_FILE="${LOG_DIR}/metrics_${TIMESTAMP}.json"

#------------------------------------------------------------------------------
# Logging Functions
#------------------------------------------------------------------------------
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    echo "${timestamp}|${level}|backup_script|${message}" | tee -a "${LOG_FILE}"
}

record_metric() {
    local metric_name=$1
    local metric_value=$2
    local metric_unit=$3
    jq -n \
        --arg name "${metric_name}" \
        --arg value "${metric_value}" \
        --arg unit "${metric_unit}" \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" \
        '{name: $name, value: $value, unit: $unit, timestamp: $timestamp}' >> "${METRICS_FILE}"
}

#------------------------------------------------------------------------------
# Prerequisite Check Functions
#------------------------------------------------------------------------------
check_prerequisites() {
    log "INFO" "Starting prerequisite checks"
    
    # Check required commands
    local required_commands=("aws" "pg_dump" "pigz" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "${cmd}" &> /dev/null; then
            log "ERROR" "Required command not found: ${cmd}"
            return 1
        fi
    done

    # Verify AWS CLI version
    local aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    if [[ ! "${aws_version}" =~ ^2\. ]]; then
        log "ERROR" "AWS CLI version 2.x required, found: ${aws_version}"
        return 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials"
        return 1
    }

    # Verify KMS key access
    if ! aws kms describe-key --key-id "${AWS_KMS_KEY_ID}" &> /dev/null; then
        log "ERROR" "Cannot access KMS key: ${AWS_KMS_KEY_ID}"
        return 1
    }

    # Check disk space
    local available_space=$(df -BG "${BACKUP_DIR%/*}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ "${available_space}" -lt 50 ]]; then
        log "ERROR" "Insufficient disk space. Required: 50GB, Available: ${available_space}GB"
        return 1
    }

    # Create and check directories
    mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"
    if [[ ! -w "${BACKUP_DIR}" ]] || [[ ! -w "${LOG_DIR}" ]]; then
        log "ERROR" "Insufficient permissions on backup or log directories"
        return 1
    }

    log "INFO" "Prerequisite checks completed successfully"
    return 0
}

#------------------------------------------------------------------------------
# Backup Functions
#------------------------------------------------------------------------------
perform_database_backup() {
    local db_name=$1
    local backup_path=$2
    local parallel_jobs=$3
    
    log "INFO" "Starting backup of database: ${db_name}"
    local start_time=$(date +%s)

    # Generate backup file name
    local backup_file="${backup_path}/${db_name}_${TIMESTAMP}.sql.gz"
    
    # Perform parallel backup with compression
    if ! PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${db_name}" \
        -j "${parallel_jobs}" \
        --format=directory \
        --verbose \
        --no-owner \
        --no-acl \
        2>> "${LOG_FILE}" | \
        pigz -${COMPRESSION_LEVEL} -p "${parallel_jobs}" > "${backup_file}"; then
        
        log "ERROR" "Backup failed for database: ${db_name}"
        return 1
    fi

    # Calculate backup size and duration
    local end_time=$(date +%s)
    local backup_size=$(stat -f%z "${backup_file}")
    local duration=$((end_time - start_time))

    # Record metrics
    record_metric "backup_size" "${backup_size}" "bytes"
    record_metric "backup_duration" "${duration}" "seconds"
    record_metric "compression_ratio" "$(echo "scale=2; ${backup_size}/$(stat -f%z "${backup_file}.raw")*100" | bc)" "percentage"

    # Verify backup integrity
    if ! gzip -t "${backup_file}"; then
        log "ERROR" "Backup verification failed for: ${backup_file}"
        return 1
    }

    log "INFO" "Backup completed successfully for database: ${db_name}"
    return 0
}

#------------------------------------------------------------------------------
# S3 Upload Functions
#------------------------------------------------------------------------------
upload_to_s3() {
    local local_file=$1
    local s3_path=$2
    local kms_key_id=$3
    
    log "INFO" "Starting S3 upload: ${local_file} to ${s3_path}"
    local start_time=$(date +%s)

    # Calculate local checksum
    local local_md5=$(md5sum "${local_file}" | cut -d' ' -f1)

    # Upload with server-side encryption
    if ! aws s3 cp "${local_file}" "s3://${s3_path}" \
        --sse aws:kms \
        --sse-kms-key-id "${kms_key_id}" \
        --metadata "md5checksum=${local_md5}" \
        --only-show-errors; then
        
        log "ERROR" "S3 upload failed for: ${local_file}"
        return 1
    fi

    # Verify upload
    local s3_md5=$(aws s3api head-object \
        --bucket "${BACKUP_BUCKET}" \
        --key "${s3_path#*/}" \
        --query 'Metadata.md5checksum' \
        --output text)

    if [[ "${local_md5}" != "${s3_md5}" ]]; then
        log "ERROR" "S3 upload verification failed: checksum mismatch"
        return 1
    fi

    # Record upload metrics
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local file_size=$(stat -f%z "${local_file}")
    record_metric "upload_speed" "$(echo "scale=2; ${file_size}/${duration}" | bc)" "bytes/second"

    log "INFO" "S3 upload completed successfully"
    return 0
}

#------------------------------------------------------------------------------
# Retention Management Functions
#------------------------------------------------------------------------------
manage_retention() {
    local backup_dir=$1
    local retention_days=$2
    local s3_prefix=$3

    log "INFO" "Starting retention management"

    # Clean local backups
    find "${backup_dir}" -type f -mtime "+${retention_days}" -delete
    
    # Configure S3 lifecycle rules
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "${BACKUP_BUCKET}" \
        --lifecycle-configuration '{
            "Rules": [
                {
                    "ID": "BackupRetentionRule",
                    "Status": "Enabled",
                    "Filter": {
                        "Prefix": "'"${s3_prefix}"'"
                    },
                    "Transitions": [
                        {
                            "Days": 30,
                            "StorageClass": "STANDARD_IA"
                        },
                        {
                            "Days": 90,
                            "StorageClass": "GLACIER"
                        }
                    ],
                    "Expiration": {
                        "Days": 365
                    }
                }
            ]
        }'

    log "INFO" "Retention management completed"
}

#------------------------------------------------------------------------------
# Main Execution
#------------------------------------------------------------------------------
main() {
    log "INFO" "Starting database backup process"

    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR" "Prerequisite checks failed"
        exit 1
    }

    # Create backup directory structure
    mkdir -p "${BACKUP_DIR}"

    # List of databases to backup
    local databases=("otpless_billing" "otpless_wallet" "otpless_events")

    # Perform backups
    for db in "${databases[@]}"; do
        if ! perform_database_backup "${db}" "${BACKUP_DIR}" "${PARALLEL_JOBS}"; then
            log "ERROR" "Backup failed for database: ${db}"
            continue
        fi

        # Upload to S3
        local s3_path="${BACKUP_BUCKET}/${BACKUP_PREFIX}/${db}/${TIMESTAMP}"
        if ! upload_to_s3 "${BACKUP_DIR}/${db}_${TIMESTAMP}.sql.gz" "${s3_path}" "${AWS_KMS_KEY_ID}"; then
            log "ERROR" "S3 upload failed for database: ${db}"
            continue
        fi
    done

    # Manage retention
    manage_retention "${BACKUP_DIR}" "${BACKUP_RETENTION_DAYS}" "${BACKUP_PREFIX}"

    # Cleanup
    rm -rf "${BACKUP_DIR}"

    log "INFO" "Backup process completed"
}

# Execute main function with error handling
if ! main; then
    log "ERROR" "Backup script failed"
    exit 1
fi

exit 0