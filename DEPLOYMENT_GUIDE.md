# 🚀 Production Deployment Guide - MooCuan

## ✅ What's Been Fixed

### 1. **WAIT Signal Instead of HOLD** (No More N/A!)
**Problem:** Indonesian stocks showing `HOLD` with `N/A N/A` values looked unprofessional
**Solution:** 
- Changed signal to `WAIT` for sideways markets
- AI now provides **actionable watchlist levels**:
  - ✅ `Entry: "Tunggu breakout di atas 9800"`
  - ✅ `Stop Loss: "Di bawah 9500 (support kunci)"`
  - ✅ `Take Profit: "Target 10200 (resistance)"`
  
**Test:** Try BBCA or IHSG during sideways market - should now see watchlist levels, not N/A!

---

### 2. **User-Specific History** (Database Migration Required)
**Problem:** All users shared the same history - privacy issue!
**Solution:**
- Added `user_id` foreign key to `analysis_history` table
- Each user now has their own private history
- JWT authentication added to history endpoints

#### 🔧 MIGRATION STEPS (REQUIRED):

**Step 1: Run Migration Endpoint**
```powershell
Invoke-RestMethod -Uri "https://moocuan.darrellvalentino.com/api/migrate-history" -Method POST
```

**Step 2: Clear Old Data in Supabase**
1. Go to https://supabase.com/dashboard
2. Open your project → SQL Editor
3. Run this query:
```sql
TRUNCATE TABLE analysis_history RESTART IDENTITY CASCADE;
```
4. Click "Run" ✅

**Step 3: Verify New Schema**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'analysis_history'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (PRIMARY KEY)
- `user_id` (INTEGER, NOT NULL, REFERENCES users.id) ← NEW!
- `ticker`, `signal`, `entry_price`, `tp1`, `tp2`, `stop_loss`
- `highest_price`, `lowest_price`, `status`, `reasoning`
- `date_created`

**Step 4: Test**
1. Login as user A → Analyze BBCA → Check history
2. Login as user B → Should NOT see user A's history ✅

---

### 3. **Portfolio Page** (Brand New Feature!)
**What:** Complete portfolio tracking system
**Location:** https://moocuan.darrellvalentino.com/portfolio

**Features:**
- 📊 Portfolio summary (Total Value, P&L, Top Gainer/Loser)
- ➕ Add positions (ticker, quantity, avg price, notes)
- ✏️ Edit existing positions
- 🗑️ Delete positions
- 🔄 Refresh prices (manual for now)
- 💰 Real-time P&L calculation
- 📈 Color-coded gains (green) and losses (red)
- 🎨 Matches MooCuan dark terminal aesthetic

**Test:**
```
1. Go to /portfolio
2. Click "Add Position"
3. Add: BBCA.JK, Qty: 100, Avg Price: 10000
4. Should see position with current P&L
5. Edit → Update quantity
6. Delete → Confirm removal
```

**Note:** Portfolio data is also per-user (using JWT authentication)

---

### 4. **Diagnostic Endpoint** (Troubleshooting Tool)
**Purpose:** Test if Detik.com is accessible from Vercel
**Endpoint:** `https://moocuan.darrellvalentino.com/api/diagnostic`

**Test:**
```powershell
Invoke-RestMethod -Uri "https://moocuan.darrellvalentino.com/api/diagnostic"
```

**Expected Response:**
```json
{
  "timestamp": "2025-11-30T...",
  "results": [
    {
      "url": "https://www.detik.com/tag/bbca",
      "status": 200,
      "ok": true,
      "hasArticles": true
    }
  ]
}
```

If `status: 403` or `hasArticles: false` → Detik is blocking Vercel IPs

---

## 🎯 Post-Deployment Checklist

### Immediate (Do Now):
- [ ] Run migration endpoint: `POST /api/migrate-history`
- [ ] Truncate `analysis_history` in Supabase SQL Editor
- [ ] Verify schema has `user_id` column
- [ ] Test login → analyze → check history (should be empty)
- [ ] Test Portfolio page: Add/Edit/Delete positions
- [ ] Test WAIT signal with BBCA (should show watchlist levels, not N/A)

### Testing (Within 24 Hours):
- [ ] Login as 2 different users → verify separate histories
- [ ] Add analysis from User A → Login as User B → should NOT see it
- [ ] Test Portfolio: Add 3-5 positions → Check P&L calculations
- [ ] Test news sentiment (should still work - BULLISH/BEARISH/NEUTRAL)
- [ ] Check Vercel logs for any errors

### Monitoring (First Week):
- [ ] Monitor Vercel Functions logs (Dashboard → Functions tab)
- [ ] Check for authentication errors (401 Unauthorized)
- [ ] Verify news scraping still working (not returning NEUTRAL always)
- [ ] Test diagnostic endpoint if news breaks

---

## 🐛 Troubleshooting

### Issue: "Unauthorized - please login" on history/portfolio
**Cause:** JWT token not being sent or expired
**Fix:**
1. Check if user is logged in: `localStorage.getItem('token')`
2. If expired, logout and login again
3. Verify Authorization header in network tab: `Bearer <token>`

### Issue: Migration endpoint returns error
**Cause:** Table might have dependencies or constraints
**Fix:**
```sql
-- Force drop if migration fails
DROP TABLE IF EXISTS analysis_history CASCADE;

-- Then run migration endpoint again
```

### Issue: Portfolio not showing positions
**Check:**
1. Network tab → `/api/portfolio` returns 200?
2. Console errors? (F12)
3. User authenticated? Check JWT token
4. Database has `portfolio_positions` table?

### Issue: WAIT signal still showing N/A
**Cause:** Gemini might not follow instructions
**Fix:** Already fixed in prompt, but if it happens:
1. Check Vercel logs for Gemini response
2. Might need to adjust prompt further
3. For now, WAIT is better than HOLD visually

---

## 📋 Database Schema Reference

### analysis_history (NEW SCHEMA)
```sql
CREATE TABLE analysis_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- NEW!
  ticker VARCHAR(20) NOT NULL,
  signal VARCHAR(10) NOT NULL,
  entry_price DECIMAL(15, 2),
  tp1 DECIMAL(15, 2),
  tp2 DECIMAL(15, 2),
  stop_loss DECIMAL(15, 2),
  highest_price DECIMAL(15, 2),
  lowest_price DECIMAL(15, 2),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  reasoning TEXT,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ticker, date_created)  -- NEW: Prevent duplicate analyses
);
```

### portfolio_positions (Already Exists)
```sql
CREATE TABLE IF NOT EXISTS portfolio_positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker VARCHAR(20) NOT NULL,
  quantity DECIMAL(15, 8) NOT NULL,
  avg_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ticker)
);
```

---

## 🚀 Next Steps (Optional Improvements)

### Short Term:
1. **Auto-refresh portfolio prices** (polling every 5 mins)
2. **Portfolio allocation pie chart** (using recharts or chart.js)
3. **Export history to CSV** (already in UI, needs backend)
4. **Push notifications for price alerts**

### Long Term:
1. **News API integration** (if Detik keeps blocking)
2. **Real-time WebSocket prices** (for live updates)
3. **Performance analytics** (Sharpe ratio, max drawdown)
4. **Social features** (share portfolio, follow traders)

---

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console (F12)
3. Check Supabase logs (Database → Logs)
4. Test endpoints with PowerShell/Postman
5. Review commit message for detailed changes

**Deployment:** https://moocuan.darrellvalentino.com
**GitHub:** https://github.com/darrellv14/maxwin

---

## ✨ Summary

**Fixed:**
- ✅ No more ugly N/A values - now shows watchlist levels
- ✅ User-specific history (privacy fix)
- ✅ Beautiful Portfolio page with full CRUD
- ✅ Diagnostic tool for troubleshooting

**Deploy:** Already pushed to main → Vercel is deploying now (check dashboard)
**Migration:** Run `/api/migrate-history` then truncate table in Supabase
**Test:** Login → Portfolio page → History page → Analyze stocks

---

**🎉 Ready for production! Good luck with the launch!**
