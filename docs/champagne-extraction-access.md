# Champagne extraction: owner controls and safe background execution

Apply D1 migration `0085_champagne_extraction_access.sql` before deploying the accompanying Worker and browser bundle. Use the project's normal migration/deployment workflow. The migration is additive: it does not rewrite wines, existing prices, balances, policies or grants.

Owner controls gains **Champagne label details extraction** under member AI action policies. It defaults to **Included free for all members**, like scanning. Owners can instead configure an independent weekly successful-run limit and grant extra runs to a member using the existing controls. One extraction of one bottle counts as one run, whether it uses one or several saved photos. Owner requests use zero-credit tracked operations and do not need a wallet top-up or member allowance. Deployment-wide budgets and concurrency limits still apply.

The browser uses the same quote, byte-identical multipart submission, account protection and idempotent network retry as other AI actions. The Worker validates ownership, Champagne eligibility and the chosen saved photos both before reservation and before background work. The extraction row and operation run ID are linked in one D1 batch before dispatch. Successful results settle the operation; ordinary failures, expiry and deleted bottles release it. An ambiguous provider submission remains in review, deliberately preventing automatic paid resubmission.

Provider routing is unchanged: Gemini 3.1 Flash Lite, Vertex AI Gateway Flex or native Gemini Batch. Native Batch now carries the same durable provider context as other research jobs. Temporary polling/dispatch errors resume the existing batch, not a new paid submission. Status reads can recover polling with the original reservation. AI usage remains attributed once per run, including unusable provider answers.

Cleanup jobs are explicitly operation-free and provider-denied. They still delete temporary payloads after settlement or member suspension, and durable outbox maintenance can redeliver lost cleanup jobs. Arbitrary jobs with a `cleanup` flag do not receive this exception.

Existing extraction suggestions remain non-destructive: users review and apply them, then save the wine. No automatic changes to logged wine details or saved original photos are introduced.

Regression coverage includes the real public multi-user entrypoint (not only the legacy inner handler), owner controls, member allowances, zero-credit owner/member execution, quote/body validation, budget enforcement, duplicate deliveries, failure settlement, native Batch polling, cleanup and uncertain provider completion.
