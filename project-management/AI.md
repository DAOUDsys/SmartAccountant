# AI

## Intent

AI capabilities will support accounting workflows such as document extraction, transaction classification, anomaly review, and financial explanations. The foundation phase only reserves architecture space for these capabilities.

## Current State

The backend contains an `ai` feature module boundary and the mobile app contains an `ai-assistant` feature folder. No provider calls, prompts, embeddings, model configuration, or AI business logic are implemented.

## Future Principles

- Keep human review available for financial decisions.
- Store sufficient audit metadata for generated outputs.
- Separate provider adapters from product workflows.
- Treat personally identifiable and financial information as sensitive by default.
- Measure cost, latency, accuracy, and user correction rates.
