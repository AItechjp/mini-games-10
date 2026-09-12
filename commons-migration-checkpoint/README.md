# Commons domain migration checkpoint

This branch preserves the verified deployed API bundle and the cutover state after the local work environment disconnected. It is not a published frontend release.

The complete frontend exists in the checkout identified in `state.json`; retrieve that checkout before rebuilding or publishing it. It contains all 14 routes, same-domain AITECH navigation, a private owner authentication gate, the portable source, and the daily public Onion snapshot workflow. Never replace the original saved database with an empty destination.

The original private Site is restored and its data remains unchanged. Automatic approval review rejected copying private D1 records to the existing Supabase project without explicit approval for that destination. The temporary import credential has been revoked. No existing room records were copied. The separately deployed owner API passed 23 real API checks, including chat edits and whiteboard clear/restore; test rooms were removed.

Resume only the unaffected source/publication work until the user explicitly approves moving existing records. Preserve concurrent changes in both source repositories. Generate fresh account setup links only after the canonical frontend is live; never commit authentication tokens, source credentials, or migration secrets.
