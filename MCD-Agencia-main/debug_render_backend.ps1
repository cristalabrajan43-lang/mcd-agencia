#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Debug script to diagnose MCD-Agencia quote loading issues.
    
.DESCRIPTION
    Comprehensive remote diagnostic tool that:
    - Checks backend health
    - Verifies quote endpoint
    - Tests CORS configuration
    - Reports issues with actionable solutions
    
.USAGE
    ./debug_render_backend.ps1
    
.NOTES
    Requires: PowerShell 5.0+
#>

param(
    [string]$QuoteToken = "f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1",
    [string]$BackendUrl = "https://mcd-agencia-api.onrender.com",
    [string]$FrontendUrl = "https://mcd-agencia.vercel.app"
)

# Colors
$Success = @{ ForegroundColor = 'Green' }
$Error = @{ ForegroundColor = 'Red' }
$Warning = @{ ForegroundColor = 'Yellow' }
$Info = @{ ForegroundColor = 'Cyan' }

Write-Host "`n" + "="*70
Write-Host "🔍 MCD-Agencia Quote Loading Diagnostic Tool" @Info
Write-Host "="*70 + "`n"

Write-Host "📋 Configuration:"
Write-Host "   Backend: $BackendUrl"
Write-Host "   Frontend: $FrontendUrl"
Write-Host "   Token: $QuoteToken`n"

# =============================================================================
# Test 1: Backend Health
# =============================================================================

Write-Host "1️⃣ Backend Health Check"
Write-Host "   Endpoint: $BackendUrl/health/" @Info

try {
    $response = Invoke-RestMethod "$BackendUrl/health/" -Method Get -TimeoutSec 10
    Write-Host "   ✅ Backend is ONLINE" @Success
    Write-Host "   Response: $($response | ConvertTo-Json)" @Success
} catch {
    Write-Host "   ❌ Backend is OFFLINE or SLOW" @Error
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" @Error
    Write-Host "   Error: $($_.Exception.Message)" @Error
    Write-Host "`n   💡 Solution: Backend is not responding"
    Write-Host "      1. Go to https://dashboard.render.com/"
    Write-Host "      2. Select 'mcd-agencia-api' service"
    Write-Host "      3. Check 'Manual Deploy' → 'Deploy latest commit'" @Warning
    Write-Host "      4. Wait for deployment to complete`n"
}

# =============================================================================
# Test 2: API Availability
# =============================================================================

Write-Host "2️⃣ API Quote Endpoint Test"
Write-Host "   Endpoint: $BackendUrl/api/v1/quotes/view/$QuoteToken/" @Info

try {
    $response = Invoke-RestMethod "$BackendUrl/api/v1/quotes/view/$QuoteToken/" `
        -Method Get -TimeoutSec 10
    Write-Host "   ✅ Quote found!" @Success
    Write-Host "   Quote #: $($response.quote_number)" @Success
    Write-Host "   Status: $($response.status_display)" @Success
    Write-Host "   Customer: $($response.customer_name)" @Success
    Write-Host "   Total: $($response.total)" @Success
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    switch ($statusCode) {
        404 {
            Write-Host "   ⚠️ Quote not found (404)" @Warning
            Write-Host "   Possible causes:" @Warning
            Write-Host "      - Token doesn't exist in database" @Warning
            Write-Host "      - Quote status is 'draft' (not public)" @Warning
            Write-Host "      - Quote was deleted" @Warning
        }
        503 {
            Write-Host "   ❌ Backend unavailable (503)" @Error
            Write-Host "   The backend service is not responding" @Error
        }
        default {
            Write-Host "   ❌ Error: HTTP $statusCode" @Error
            Write-Host "   $($_.Exception.Message)" @Error
        }
    }
}

# =============================================================================
# Test 3: CORS Configuration
# =============================================================================

Write-Host "`n3️⃣ CORS Headers Check"
Write-Host "   Testing if backend allows requests from: $FrontendUrl" @Info

try {
    $response = Invoke-WebRequest "$BackendUrl/api/v1/quotes/view/$QuoteToken/" `
        -Method Get `
        -Headers @{ "Origin" = $FrontendUrl } `
        -TimeoutSec 10 `
        -SkipHttpErrorCheck
    
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    
    if ($corsHeader) {
        Write-Host "   ✅ CORS is enabled" @Success
        Write-Host "   Allow-Origin: $corsHeader" @Success
    } else {
        Write-Host "   ⚠️ CORS header not found" @Warning
        Write-Host "   This might be configured server-side" @Warning
    }
} catch {
    Write-Host "   ⚠️ Could not check CORS headers" @Warning
    Write-Host "   Error: $($_.Exception.Message)" @Warning
}

# =============================================================================
# Test 4: Network Connectivity
# =============================================================================

Write-Host "`n4️⃣ Network Connectivity"
Write-Host "   Checking connectivity to:" @Info

# Test backend
Write-Host "   → Backend (Render)... " -NoNewline
try {
    $null = [System.Net.Dns]::GetHostAddresses("mcd-agencia-api.onrender.com")
    Write-Host "✅ Reachable" @Success
} catch {
    Write-Host "❌ Unreachable" @Error
}

# Test frontend
Write-Host "   → Frontend (Vercel)... " -NoNewline
try {
    $null = [System.Net.Dns]::GetHostAddresses("mcd-agencia.vercel.app")
    Write-Host "✅ Reachable" @Success
} catch {
    Write-Host "❌ Unreachable" @Error
}

# =============================================================================
# Test 5: Frontend Page Load
# =============================================================================

Write-Host "`n5️⃣ Frontend Quote Page"
Write-Host "   URL: $FrontendUrl/es/cotizacion/$QuoteToken/" @Info

try {
    $response = Invoke-WebRequest "$FrontendUrl/es/cotizacion/$QuoteToken/" `
        -TimeoutSec 10 -SkipHttpErrorCheck
    
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Page loads (HTTP 200)" @Success
        Write-Host "   Note: Page may show error if API is down" @Info
    } else {
        Write-Host "   ⚠️ HTTP $($response.StatusCode)" @Warning
    }
} catch {
    Write-Host "   ❌ Could not reach frontend" @Error
    Write-Host "   $($_.Exception.Message)" @Error
}

# =============================================================================
# Summary & Recommendations
# =============================================================================

Write-Host "`n" + "="*70
Write-Host "📊 Summary & Next Steps" @Info
Write-Host "="*70 + "`n"

Write-Host "🎯 Action Plan:" @Warning
Write-Host "`n1. Check Backend Status:"
Write-Host "   Dashboard → https://dashboard.render.com/"
Write-Host "   Service → mcd-agencia-api"
Write-Host "   Look for red errors in Logs`n"

Write-Host "2. If Backend is Down:"
Write-Host "   Click 'Manual Deploy' → 'Deploy latest commit'"
Write-Host "   Wait for deployment (5-10 min)"
Write-Host "   Check Logs → Should see 'Listening on 0.0.0.0:...'" @Success + "`n"

Write-Host "3. If Database is Down:"
Write-Host "   Go to mcd-agencia-db (database service)"
Write-Host "   Check if it's 'Active'"
Write-Host "   If not, restart it" @Warning + "`n"

Write-Host "4. If Everything is Green:"
Write-Host "   Hard refresh browser: Ctrl+Shift+R"
Write-Host "   Clear browser cache" @Success + "`n"

Write-Host "5. Get Help:"
Write-Host "   Open Render Dashboard Logs"
Write-Host "   Find the FIRST red error line"
Write-Host "   Copy the full error message"
Write-Host "   Create an issue with the full error" @Info + "`n"

Write-Host "="*70 + "`n"
