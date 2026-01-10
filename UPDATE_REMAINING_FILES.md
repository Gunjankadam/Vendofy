# Instructions to Update Remaining Files

The following files still need to be updated to use the environment variable for the API URL:

1. **src/pages/ProductManagement.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
2. **src/pages/Dashboard.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
3. **src/pages/DistributorPricing.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
4. **src/pages/DistributorOrders.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
5. **src/pages/AdminOrderNotifications.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
6. **src/pages/CustomerCheckout.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
7. **src/pages/CustomerProducts.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
8. **src/pages/UserManagement.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
9. **src/pages/DistributorTransit.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
10. **src/pages/AdminProductUsage.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`
11. **src/pages/SystemSettings.tsx** - Replace all `http://localhost:5000` with `getApiUrl('')`

## Steps for each file:

1. Add import at the top: `import { getApiUrl } from '@/lib/api';`
2. Replace all instances of `'http://localhost:5000/api/...'` with `getApiUrl('/api/...')`
3. Replace all instances of `` `http://localhost:5000/api/...` `` with `` getApiUrl(`/api/...`) ``

## Example:
```typescript
// Before:
const res = await fetch('http://localhost:5000/api/products', {

// After:
const res = await fetch(getApiUrl('/api/products'), {

// Before:
const res = await fetch(`http://localhost:5000/api/products/${id}`, {

// After:
const res = await fetch(getApiUrl(`/api/products/${id}`), {
```

