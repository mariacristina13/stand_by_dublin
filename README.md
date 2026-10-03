

LIVE APP: https://lock-and-ride.vercel.app
VIDEO: https://www.loom.com/share/cd6383e6d02a4e52a8d4df2c39db5847

**Dublin Lock & Ride** helps cyclists decide where to lock up right now. Bike theft is a constant worry in Dublin, but the information is scattered across group chats and static open-data lists.
The app maps the city's bike stands, colour-codes each one by live theft risk (weighted by severity, recency and distance of nearby reports), and lets anyone report a theft that updates the map for everyone instantly.
You can search for a place to see the nearest stands and the risk at that spot, or ask in plain English ("someone testing locks near college") to find similar reports even when the wording differs.
Under the hood it runs on MongoDB Atlas: `2dsphere` geospatial queries (`$geoNear`, `$geoWithin`) find stands and score risk, Atlas Vector Search with Automated Embedding (Voyage) powers the natural-language search, Change Streams push new reports to every open map in real time, and a TTL index expires minor reports after 48 hours so the map never goes stale.
