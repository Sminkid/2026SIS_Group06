This regression fixture is a projection of the planner's read-only USYD 2026 API responses captured on 5 October 2026, after the repaired import.

It retains the BHENGINE-04 stream choice group, all 12 streams' formal specialisation relationship groups, all 49 referenced specialisation component details, and all 196 CUSP plan metadata records. Subject scheduling rows are omitted (`years: []`); scheduling behavior has separate roadmap fixtures and live acceptance checks.

The fixture is test data only. Production selection, availability, credit points and requirements are loaded through the existing degree/component APIs. Updating it requires a verified import, not inferred CUSP title relationships.
