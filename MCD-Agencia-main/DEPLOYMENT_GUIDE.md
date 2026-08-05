# 🧹 Dashboard #N/A Fix - Deployment Guide

## Problem
Production dashboards were showing `#N/A` for all items, indicating corrupted jobs without valid `order_number` data.

## Root Cause
ProductionJobs/LogisticsJobs were created but not properly linked to Order records, resulting in:
- `order = null` OR
- `order.order_number = null/empty string`

## Solution Implemented

### 1. Backend Code ✅
- **Serializers**: Already fixed to return `order_number`, `order_id`, `customer`
- **Database Queries**: Already use `select_related('order', 'order__user')`
- **Frontend Fallback**: Already has `#N/A` protection

### 2. Cleanup Migration ✅
Created automatic migration that removes corrupted jobs:
- File: `backend/apps/orders/migrations/0006_cleanup_corrupted_jobs.py`
- Removes jobs where `order_number` is null/empty
- Runs automatically during `python manage.py migrate`
- Tested locally - works correctly

### 3. Management Command ✅
Created manual cleanup tool:
- File: `backend/apps/orders/management/commands/cleanup_corrupted_jobs.py`
- Run locally: `python manage.py cleanup_corrupted_jobs --dry-run`
- Run for real: `python manage.py cleanup_corrupted_jobs`

## Deployment Steps

### Option A: Using Fly.io CLI (Recommended)

1. **Authenticate with Fly.io**
   ```bash
   fly auth login
   ```

2. **Run deployment script**
   ```bash
   bash deploy.sh
   ```

3. **Monitor deployment**
   ```bash
   fly logs --app mcd-agencia-api
   ```

### Option B: Manual Fly.io Deploy

1. **Authenticate**
   ```bash
   fly auth login
   ```

2. **Deploy**
   ```bash
   cd backend
   fly deploy
   ```

3. **Check migrations ran**
   ```bash
   fly logs --app mcd-agencia-api | grep "Cleaning corrupted"
   ```

### Option C: Remote SSH (Advanced)

If you need to run cleanup without redeployment:

```bash
fly ssh console -a mcd-agencia-api
> cd /app
> python manage.py cleanup_corrupted_jobs
```

## Expected Output

After deployment, you should see in logs:

```
🧹 Cleaning corrupted jobs...
   ProductionJobs: 7
   LogisticsJobs: 0
   FieldOperationJobs: 0
   ✅ Deleted 7 corrupted jobs
```

## Verification

After deployment:

1. **Refresh dashboards** in browser (Cmd+Shift+R)
2. **Expected**: Production dashboard should now show:
   - Real order numbers (e.g., `#ORD-001`)
   - Customer names
   - Order status
   - No more `#N/A` items

If items still show `#N/A`:
- Either new corrupted data was created after migration
- Or frontend cache needs clearing
- Run `fly logs` to check for errors

## Git Commits

✅ All changes committed:
- `1b975ff`: Added management command
- `40deea9`: Added automatic cleanup migration

## Files Modified

```
backend/
├── apps/orders/
│   ├── migrations/
│   │   └── 0006_cleanup_corrupted_jobs.py (NEW)
│   └── management/commands/
│       └── cleanup_corrupted_jobs.py (NEW)
├── deploy.sh (NEW)
└── Dockerfile.prod (unchanged)
```

## Rollback (if needed)

If migration causes issues:

```bash
fly ssh console -a mcd-agencia-api
> cd /app
> python manage.py migrate orders 0005
```

## Questions?

- Check Fly.io logs: `fly logs -a mcd-agencia-api`
- Check local Django: `python manage.py show_migrations orders`
- Manual cleanup: `python manage.py cleanup_corrupted_jobs --help`

---

**Status**: ✅ Ready for production deployment
**Last Updated**: May 4, 2026
