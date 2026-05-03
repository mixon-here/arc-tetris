# Security Specification for Arc Tetris

### Data Invariants
1. A valid leaderboard entry must contain `walletAddress`, `score`, `lines`, and `timestamp`.
2. The `walletAddress` must be exactly 42 characters strings representing an EVM address.
3. The `score` and `lines` must be non-negative integers mapping reasonable limits for a game. 
4. The `timestamp` MUST represent the exact time of submission from the server `request.time.toMillis()`, completely denying any timestamps configured by clients.

### The Dirty Dozen Payloads:
1. Complete empty payload `{}`
2. Field Injection `{walletAddress, score, lines, timestamp, maliciousField: "XSS"}`
3. Missing fields `{walletAddress, score}`
4. Negative score `{...score:-1000}`
5. 1GB Payload String in WalletAddress
6. Negative lines 
7. Spoofed Server Timestamp
8. Malicious string ID length > 128
9. Incorrect type (string score)
10. Massive arbitrary integer in score field
11. No fields, but matches ID
12. Attempt to update/delete an existing score.

### Rules Coverage
The implemented `firestore.rules` checks the `hasAll` and `size() == 4` logic to enforce explicit schema matching (denying payloads 1, 2, 3, 11). Type validation blocks payloads 9. Negative value validation blocks 4, 6. The `request.time.toMillis()` requirement enforces invariant 4. Limit on string boundaries restrict payload 5. Update/delete are inherently blocked globally as only `allow create` is explicitly provided.
