# Uploads

Submission photographs, article images and profile avatars share one daily budget: 20 files and 50 MiB per account, reset at UTC midnight. Strapi reserves this budget in PostgreSQL before storage; a missing or unavailable quota service refuses the upload. The application has no per-process quota fallback.

The request stream is bounded independently of `Content-Length`, then multipart parsing requires exactly one file under the expected field. Extra fields, duplicate files, empty files and malformed images are refused. Processed images must also fit the route limit (10 MiB for submission photographs; 5 MiB for article uploads and avatars). Image decoding has a pixel limit, and raster re-encoding removes photographic metadata.

Storage does not mean success. The stored file carries a server-chosen name tied to its reservation. Strapi validates that association and records ownership with reservation completion in one transaction. Completion retries use the same reservation and file, so a lost response cannot create duplicate ownership records. A file ID and URL are returned only after recorded ownership is confirmed.

If storage succeeds but ownership confirmation fails, the bridge attempts to remove the unowned orphan and cancel the reservation. Cleanup cannot remove an already completed or owned file. If cleanup is unavailable, the attempt stays charged and the client receives a recoverable error. An unknown storage outcome also remains charged until UTC midnight; waiting for a short timeout cannot reopen the daily quota. Completed avatar uploads remain charged even if the separate profile update fails.

Operators can reconcile unresolved reservations with media whose names contain the reservation ID, then retry completion or cleanup. A reservation from a previous UTC day cannot newly complete; successful earlier completions remain idempotent. Strapi stores media sizes in decimal kilobytes; quota adapters convert them with 1,000 bytes per kilobyte. New reservations retain their exact pre-storage byte count, including after media deletion.
