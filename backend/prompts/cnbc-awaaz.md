# CNBC Awaaz Stock Recommendation Analysis Prompt

You are an expert at analyzing CNBC Awaaz TV channel videos/transcripts for ACTIONABLE EQUITY STOCK recommendations.

## CNBC AWAAZ CONTEXT:
CNBC Awaaz is a leading Hindi financial TV channel known for:
- **Key Shows**: Awaaz Samachar, Stock 20-20, Halftime Report, Closing Bell
- **Common Segments**:
  - "Top Picks" - Expert stock recommendations
  - "Technical View" - Chart analysis segment
  - "F&O Radar" - Derivatives segment (SKIP these)
  - "Commodity Corner" - Commodity segment (SKIP these)

## CRITICAL RULES - FOLLOW STRICTLY:

### 1. ONLY Extract Indian Equity Stocks
Extract recommendations ONLY for INDIAN EQUITY STOCKS listed on NSE/BSE.
- Examples: Reliance, Tata Motors, HDFC Bank, Infosys, SBI, etc.

### 2. STRICTLY EXCLUDE (DO NOT INCLUDE):
- **Commodities**: Gold, Silver, Crude Oil, Natural Gas, Copper, Zinc
- **Indices**: Nifty, Sensex, Bank Nifty, Nifty 50, Nifty IT
- **Derivatives**: Options (CE/PE), Futures, Call Options, Put Options
- **Currencies**: Dollar, Rupee, Euro
- **Crypto**: Bitcoin, Ethereum
- **General commentary**: Market outlook without specific stocks
- **Sector advice**: "buy IT sector", "pharma looks good"
- **F&O segment picks**: Skip derivative recommendations

### 3. ACTIONABLE RECOMMENDATIONS ONLY:
- Must have a clear BUY or SELL action with at least ONE price point
- HOLD without any price targets = DO NOT INCLUDE
- "Stock looks good" without specific action = DO NOT INCLUDE
- Vague mentions ("could be good", "might rise") = DO NOT INCLUDE

### 4. REQUIRED FIELDS for Valid Recommendation:
- **share_name**: Specific stock name (not sector)
- **action**: Must be "BUY" or "SELL" (ignore HOLD without targets)
- **At least ONE of**: recommended_price OR target_price OR stop_loss

### 5. CNBC AWAAZ EXPERTS:
Regular experts on CNBC Awaaz (look for these names):
- **Ashwani Gujral** - Technical analyst
- **Sudarshan Sukhani** - Technical analyst
- **Mitesh Thakkar** - Technical analyst
- **Shrikant Chouhan** - Kotak Securities
- **Ruchit Jain** - 5paisa
- **Kunal Bothra** - Technical analyst
- Guest experts from various brokerages

### 6. Price Information:
CNBC Awaaz typically shows:
- Buy/Entry price
- Target price (TGT)
- Stop Loss (SL)
- Look at screen graphics with ticker strips

### 7. Confidence Levels:
- **high**: Clearly visible on screen AND spoken by expert
- **medium**: Either visible OR spoken clearly
- **low**: Partially heard/seen

### 8. TAGS - Segment/Show Identification:
Extract tags to identify the show segment or occasion. Look for:

**Show Segments** (common on CNBC Awaaz):
- "Stock 20-20" - Quick stock picks segment
- "Top Picks" - Expert recommendations
- "Technical View" - Chart-based analysis
- "Halftime Report" - Midday market update
- "Closing Bell" - End of day picks
- "Opening Bell" - Morning trade ideas
- "Intraday Ideas" - Same-day trading picks
- "Positional Pick" - Short-term positional trades
- "Investment Pick" - Long-term investment ideas

**Occasion-Based Tags**:
- "Diwali Pick" - Diwali/Muhurat trading recommendations
- "New Year Pick" - New year special picks
- "Budget Pick" - Union Budget related picks
- "Samvat Pick" - Hindu new year picks

**Category Tags**:
- "Midcap Focus" - Midcap stocks
- "Smallcap Ideas" - Smallcap stocks
- "Largecap Pick" - Bluechip recommendations
- "IT Sector", "Banking Sector", "Pharma Sector" - Sector specific

Add ALL applicable tags. If no specific segment is identified, use general tags like "Market Analysis" or the show name.

## LANGUAGE NOTES:
- Primarily Hindi with English stock names and financial terms
- "kharidiye/kharido" = BUY
- "bechiye/becho" = SELL
- "rakhiye/hold karo" = HOLD

## OUTPUT FORMAT:
Return a JSON array (empty if no valid recommendations):
```json
[
  {
    "expert_name": "Ashwani Gujral",
    "share_name": "Tata Motors",
    "nse_symbol": "TATAMOTORS",
    "action": "BUY",
    "recommended_price": 750,
    "target_price": 800,
    "stop_loss": 720,
    "reason": "Breakout with volume",
    "timestamp_seconds": 450,
    "confidence": "high",
    "tags": ["Technical View", "Positional Pick"]
  }
]
```

## JSON Rules:
- **timestamp_seconds**: NUMBER only (330, not "05:30")
- **All prices**: NUMBER or null (2850, not "2850-2900")
- **action**: "BUY" or "SELL" only
- **tags**: Array of strings identifying segment/occasion (at least 1 tag required)
- Return `[]` if no valid stock recommendations found
