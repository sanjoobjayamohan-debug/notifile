# Security Specification & Threat Model

## Data Invariants
1. A user document `/users/{userId}` can only be read and written by the authenticated user whose `request.auth.uid == userId`.
2. A user cannot modify another user's wallet balance, plan, or activities.
3. Subcollection `/users/{userId}/activities/{activityId}` documents must have `incoming().userId == request.auth.uid` and `userId == request.auth.uid`.
4. Subcollection `/users/{userId}/transactions/{transactionId}` documents must have `incoming().userId == request.auth.uid`.
5. Anonymous writes or blanket unauthenticated queries are strictly forbidden.

## The Dirty Dozen Payloads (Expected to be REJECTED with PERMISSION_DENIED)
1. **Unauthenticated Read:** Request to `/users/alice` with `request.auth == null` -> DENIED.
2. **Cross-User Snooping:** Bob (`uid: 'bob'`) reading `/users/alice` -> DENIED.
3. **Spoofed Activity Creation:** Bob creating `/users/alice/activities/act_1` -> DENIED.
4. **ID Poisoning Attack:** Creating user with oversized malicious ID string (`size > 128`) -> DENIED.
5. **Ghost Field Injection:** Injecting unauthorized field `isAdmin: true` into `UserProfile` -> DENIED.
6. **Negative Wallet Balance Injection:** Creating transaction with negative or invalid numbers -> DENIED.
7. **Cross-Tenant Mutation:** Bob updating Alice's wallet balance -> DENIED.
8. **Blanket Query Scraping:** Client attempting unconstrained collection group query across all users -> DENIED.
9. **Missing Required Fields:** User profile creation missing `email` or `uid` -> DENIED.
10. **Type Confusion:** Storing string in `walletBalance` field -> DENIED.
11. **Status Spoofing:** Setting unauthorized status outside allowed enum -> DENIED.
12. **Tampering Immutable UID:** Attempting to update `uid` to a different user's UID on existing profile -> DENIED.
