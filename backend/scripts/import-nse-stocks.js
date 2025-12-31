/**
 * Import NSE Stocks
 *
 * This script imports NSE stock data. It includes a comprehensive list of
 * major NSE stocks with sector classifications.
 *
 * Usage: node scripts/import-nse-stocks.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

// Comprehensive list of major NSE stocks with sectors
const NSE_STOCKS = [
  // NIFTY 50 - Large Cap
  { symbol: 'RELIANCE', company_name: 'Reliance Industries Ltd', sector: 'Oil & Gas', industry: 'Refineries', market_cap_category: 'LARGE_CAP', isin: 'INE002A01018' },
  { symbol: 'TCS', company_name: 'Tata Consultancy Services Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'LARGE_CAP', isin: 'INE467B01029' },
  { symbol: 'HDFCBANK', company_name: 'HDFC Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE040A01034' },
  { symbol: 'INFY', company_name: 'Infosys Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'LARGE_CAP', isin: 'INE009A01021' },
  { symbol: 'ICICIBANK', company_name: 'ICICI Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE090A01021' },
  { symbol: 'HINDUNILVR', company_name: 'Hindustan Unilever Ltd', sector: 'FMCG', industry: 'Personal Products', market_cap_category: 'LARGE_CAP', isin: 'INE030A01027' },
  { symbol: 'BHARTIARTL', company_name: 'Bharti Airtel Ltd', sector: 'Telecommunication', industry: 'Telecom Services', market_cap_category: 'LARGE_CAP', isin: 'INE397D01024' },
  { symbol: 'SBIN', company_name: 'State Bank of India', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE062A01020' },
  { symbol: 'ITC', company_name: 'ITC Ltd', sector: 'FMCG', industry: 'Tobacco', market_cap_category: 'LARGE_CAP', isin: 'INE154A01025' },
  { symbol: 'KOTAKBANK', company_name: 'Kotak Mahindra Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE237A01028' },
  { symbol: 'LT', company_name: 'Larsen & Toubro Ltd', sector: 'Construction', industry: 'Infrastructure', market_cap_category: 'LARGE_CAP', isin: 'INE018A01030' },
  { symbol: 'HCLTECH', company_name: 'HCL Technologies Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'LARGE_CAP', isin: 'INE860A01027' },
  { symbol: 'AXISBANK', company_name: 'Axis Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE238A01034' },
  { symbol: 'ASIANPAINT', company_name: 'Asian Paints Ltd', sector: 'Consumer Durables', industry: 'Paints', market_cap_category: 'LARGE_CAP', isin: 'INE021A01026' },
  { symbol: 'MARUTI', company_name: 'Maruti Suzuki India Ltd', sector: 'Automobile', industry: 'Passenger Cars', market_cap_category: 'LARGE_CAP', isin: 'INE585B01010' },
  { symbol: 'SUNPHARMA', company_name: 'Sun Pharmaceutical Industries Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'LARGE_CAP', isin: 'INE044A01036' },
  { symbol: 'TITAN', company_name: 'Titan Company Ltd', sector: 'Consumer Durables', industry: 'Jewellery', market_cap_category: 'LARGE_CAP', isin: 'INE280A01028' },
  { symbol: 'BAJFINANCE', company_name: 'Bajaj Finance Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'LARGE_CAP', isin: 'INE296A01024' },
  { symbol: 'WIPRO', company_name: 'Wipro Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'LARGE_CAP', isin: 'INE075A01022' },
  { symbol: 'ULTRACEMCO', company_name: 'UltraTech Cement Ltd', sector: 'Construction Materials', industry: 'Cement', market_cap_category: 'LARGE_CAP', isin: 'INE481G01011' },
  { symbol: 'TATAMOTORS', company_name: 'Tata Motors Ltd', sector: 'Automobile', industry: 'Auto - Commercial', market_cap_category: 'LARGE_CAP', isin: 'INE155A01022' },
  { symbol: 'TATASTEEL', company_name: 'Tata Steel Ltd', sector: 'Metals & Mining', industry: 'Steel', market_cap_category: 'LARGE_CAP', isin: 'INE081A01020' },
  { symbol: 'POWERGRID', company_name: 'Power Grid Corporation of India Ltd', sector: 'Power', industry: 'Power Transmission', market_cap_category: 'LARGE_CAP', isin: 'INE752E01010' },
  { symbol: 'NTPC', company_name: 'NTPC Ltd', sector: 'Power', industry: 'Power Generation', market_cap_category: 'LARGE_CAP', isin: 'INE733E01010' },
  { symbol: 'ONGC', company_name: 'Oil and Natural Gas Corporation Ltd', sector: 'Oil & Gas', industry: 'Exploration', market_cap_category: 'LARGE_CAP', isin: 'INE213A01029' },
  { symbol: 'NESTLEIND', company_name: 'Nestle India Ltd', sector: 'FMCG', industry: 'Food Products', market_cap_category: 'LARGE_CAP', isin: 'INE239A01016' },
  { symbol: 'JSWSTEEL', company_name: 'JSW Steel Ltd', sector: 'Metals & Mining', industry: 'Steel', market_cap_category: 'LARGE_CAP', isin: 'INE019A01038' },
  { symbol: 'M&M', company_name: 'Mahindra & Mahindra Ltd', sector: 'Automobile', industry: 'Auto - Tractors', market_cap_category: 'LARGE_CAP', isin: 'INE101A01026' },
  { symbol: 'TECHM', company_name: 'Tech Mahindra Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'LARGE_CAP', isin: 'INE669C01036' },
  { symbol: 'BAJAJFINSV', company_name: 'Bajaj Finserv Ltd', sector: 'Financial Services', industry: 'Holding Company', market_cap_category: 'LARGE_CAP', isin: 'INE918I01018' },
  { symbol: 'INDUSINDBK', company_name: 'IndusInd Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'LARGE_CAP', isin: 'INE095A01012' },
  { symbol: 'ADANIENT', company_name: 'Adani Enterprises Ltd', sector: 'Diversified', industry: 'Trading', market_cap_category: 'LARGE_CAP', isin: 'INE423A01024' },
  { symbol: 'ADANIPORTS', company_name: 'Adani Ports and SEZ Ltd', sector: 'Services', industry: 'Port Services', market_cap_category: 'LARGE_CAP', isin: 'INE742F01042' },
  { symbol: 'COALINDIA', company_name: 'Coal India Ltd', sector: 'Metals & Mining', industry: 'Coal', market_cap_category: 'LARGE_CAP', isin: 'INE522F01014' },
  { symbol: 'DRREDDY', company_name: 'Dr. Reddys Laboratories Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'LARGE_CAP', isin: 'INE089A01023' },
  { symbol: 'CIPLA', company_name: 'Cipla Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'LARGE_CAP', isin: 'INE059A01026' },
  { symbol: 'HINDALCO', company_name: 'Hindalco Industries Ltd', sector: 'Metals & Mining', industry: 'Aluminium', market_cap_category: 'LARGE_CAP', isin: 'INE038A01020' },
  { symbol: 'GRASIM', company_name: 'Grasim Industries Ltd', sector: 'Diversified', industry: 'Cement & Textiles', market_cap_category: 'LARGE_CAP', isin: 'INE047A01021' },
  { symbol: 'DIVISLAB', company_name: 'Divis Laboratories Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'LARGE_CAP', isin: 'INE361B01024' },
  { symbol: 'BAJAJ-AUTO', company_name: 'Bajaj Auto Ltd', sector: 'Automobile', industry: 'Two Wheelers', market_cap_category: 'LARGE_CAP', isin: 'INE917I01010' },
  { symbol: 'EICHERMOT', company_name: 'Eicher Motors Ltd', sector: 'Automobile', industry: 'Two Wheelers', market_cap_category: 'LARGE_CAP', isin: 'INE066A01021' },
  { symbol: 'BRITANNIA', company_name: 'Britannia Industries Ltd', sector: 'FMCG', industry: 'Food Products', market_cap_category: 'LARGE_CAP', isin: 'INE216A01030' },
  { symbol: 'HEROMOTOCO', company_name: 'Hero MotoCorp Ltd', sector: 'Automobile', industry: 'Two Wheelers', market_cap_category: 'LARGE_CAP', isin: 'INE158A01026' },
  { symbol: 'SBILIFE', company_name: 'SBI Life Insurance Company Ltd', sector: 'Financial Services', industry: 'Insurance', market_cap_category: 'LARGE_CAP', isin: 'INE123W01016' },
  { symbol: 'HDFCLIFE', company_name: 'HDFC Life Insurance Company Ltd', sector: 'Financial Services', industry: 'Insurance', market_cap_category: 'LARGE_CAP', isin: 'INE795G01014' },
  { symbol: 'BPCL', company_name: 'Bharat Petroleum Corporation Ltd', sector: 'Oil & Gas', industry: 'Refineries', market_cap_category: 'LARGE_CAP', isin: 'INE029A01011' },
  { symbol: 'APOLLOHOSP', company_name: 'Apollo Hospitals Enterprise Ltd', sector: 'Healthcare', industry: 'Hospitals', market_cap_category: 'LARGE_CAP', isin: 'INE437A01024' },
  { symbol: 'TATACONSUM', company_name: 'Tata Consumer Products Ltd', sector: 'FMCG', industry: 'Food Products', market_cap_category: 'LARGE_CAP', isin: 'INE192A01025' },
  { symbol: 'UPL', company_name: 'UPL Ltd', sector: 'Chemicals', industry: 'Agrochemicals', market_cap_category: 'LARGE_CAP', isin: 'INE628A01036' },

  // Mid Cap Stocks
  { symbol: 'ZOMATO', company_name: 'Zomato Ltd', sector: 'Consumer Services', industry: 'Food Delivery', market_cap_category: 'MID_CAP', isin: 'INE758T01015' },
  { symbol: 'NYKAA', company_name: 'FSN E-Commerce Ventures Ltd', sector: 'Consumer Services', industry: 'E-commerce', market_cap_category: 'MID_CAP', isin: 'INE388Y01029' },
  { symbol: 'DMART', company_name: 'Avenue Supermarts Ltd', sector: 'Consumer Services', industry: 'Retail', market_cap_category: 'LARGE_CAP', isin: 'INE192R01011' },
  { symbol: 'PIDILITIND', company_name: 'Pidilite Industries Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'LARGE_CAP', isin: 'INE318A01026' },
  { symbol: 'HAVELLS', company_name: 'Havells India Ltd', sector: 'Consumer Durables', industry: 'Electrical Equipment', market_cap_category: 'MID_CAP', isin: 'INE176B01034' },
  { symbol: 'GODREJCP', company_name: 'Godrej Consumer Products Ltd', sector: 'FMCG', industry: 'Personal Products', market_cap_category: 'MID_CAP', isin: 'INE102D01028' },
  { symbol: 'DABUR', company_name: 'Dabur India Ltd', sector: 'FMCG', industry: 'Personal Products', market_cap_category: 'LARGE_CAP', isin: 'INE016A01026' },
  { symbol: 'MARICO', company_name: 'Marico Ltd', sector: 'FMCG', industry: 'Personal Products', market_cap_category: 'MID_CAP', isin: 'INE196A01026' },
  { symbol: 'COLPAL', company_name: 'Colgate-Palmolive (India) Ltd', sector: 'FMCG', industry: 'Personal Products', market_cap_category: 'MID_CAP', isin: 'INE259A01022' },
  { symbol: 'BERGEPAINT', company_name: 'Berger Paints India Ltd', sector: 'Consumer Durables', industry: 'Paints', market_cap_category: 'MID_CAP', isin: 'INE463A01038' },
  { symbol: 'SIEMENS', company_name: 'Siemens Ltd', sector: 'Capital Goods', industry: 'Electrical Equipment', market_cap_category: 'MID_CAP', isin: 'INE003A01024' },
  { symbol: 'ABB', company_name: 'ABB India Ltd', sector: 'Capital Goods', industry: 'Electrical Equipment', market_cap_category: 'MID_CAP', isin: 'INE117A01022' },
  { symbol: 'BOSCHLTD', company_name: 'Bosch Ltd', sector: 'Automobile', industry: 'Auto Ancillaries', market_cap_category: 'MID_CAP', isin: 'INE323A01026' },
  { symbol: 'MUTHOOTFIN', company_name: 'Muthoot Finance Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'MID_CAP', isin: 'INE414G01012' },
  { symbol: 'CHOLAFIN', company_name: 'Cholamandalam Investment and Finance Co Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'MID_CAP', isin: 'INE121A01024' },
  { symbol: 'MPHASIS', company_name: 'Mphasis Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'MID_CAP', isin: 'INE356A01018' },
  { symbol: 'LTIM', company_name: 'LTIMindtree Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'MID_CAP', isin: 'INE214T01019' },
  { symbol: 'PERSISTENT', company_name: 'Persistent Systems Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'MID_CAP', isin: 'INE262H01013' },
  { symbol: 'COFORGE', company_name: 'Coforge Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'MID_CAP', isin: 'INE591G01017' },
  { symbol: 'PIIND', company_name: 'PI Industries Ltd', sector: 'Chemicals', industry: 'Agrochemicals', market_cap_category: 'MID_CAP', isin: 'INE603J01030' },
  { symbol: 'ATUL', company_name: 'Atul Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE100A01010' },
  { symbol: 'SRF', company_name: 'SRF Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE647A01010' },
  { symbol: 'TRENT', company_name: 'Trent Ltd', sector: 'Consumer Services', industry: 'Retail', market_cap_category: 'MID_CAP', isin: 'INE849A01020' },
  { symbol: 'PAGEIND', company_name: 'Page Industries Ltd', sector: 'Textiles', industry: 'Apparel', market_cap_category: 'MID_CAP', isin: 'INE761H01022' },
  { symbol: 'ASTRAL', company_name: 'Astral Ltd', sector: 'Capital Goods', industry: 'Pipes', market_cap_category: 'MID_CAP', isin: 'INE006I01046' },
  { symbol: 'VOLTAS', company_name: 'Voltas Ltd', sector: 'Consumer Durables', industry: 'Air Conditioners', market_cap_category: 'MID_CAP', isin: 'INE226A01021' },
  { symbol: 'CROMPTON', company_name: 'Crompton Greaves Consumer Electricals Ltd', sector: 'Consumer Durables', industry: 'Electrical Equipment', market_cap_category: 'MID_CAP', isin: 'INE299U01018' },
  { symbol: 'POLYCAB', company_name: 'Polycab India Ltd', sector: 'Capital Goods', industry: 'Cables', market_cap_category: 'MID_CAP', isin: 'INE455K01017' },
  { symbol: 'BHARATFORG', company_name: 'Bharat Forge Ltd', sector: 'Capital Goods', industry: 'Castings/Forgings', market_cap_category: 'MID_CAP', isin: 'INE465A01025' },
  { symbol: 'ESCORTS', company_name: 'Escorts Kubota Ltd', sector: 'Automobile', industry: 'Tractors', market_cap_category: 'MID_CAP', isin: 'INE042A01014' },
  { symbol: 'TVSMOTOR', company_name: 'TVS Motor Company Ltd', sector: 'Automobile', industry: 'Two Wheelers', market_cap_category: 'MID_CAP', isin: 'INE494B01023' },
  { symbol: 'BALKRISIND', company_name: 'Balkrishna Industries Ltd', sector: 'Automobile', industry: 'Tyres', market_cap_category: 'MID_CAP', isin: 'INE787D01026' },
  { symbol: 'APOLLOTYRE', company_name: 'Apollo Tyres Ltd', sector: 'Automobile', industry: 'Tyres', market_cap_category: 'MID_CAP', isin: 'INE438A01022' },
  { symbol: 'MRF', company_name: 'MRF Ltd', sector: 'Automobile', industry: 'Tyres', market_cap_category: 'MID_CAP', isin: 'INE883A01011' },
  { symbol: 'MOTHERSON', company_name: 'Samvardhana Motherson International Ltd', sector: 'Automobile', industry: 'Auto Ancillaries', market_cap_category: 'MID_CAP', isin: 'INE775A01035' },
  { symbol: 'LUPIN', company_name: 'Lupin Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'MID_CAP', isin: 'INE326A01037' },
  { symbol: 'BIOCON', company_name: 'Biocon Ltd', sector: 'Healthcare', industry: 'Biotechnology', market_cap_category: 'MID_CAP', isin: 'INE376G01013' },
  { symbol: 'AUROPHARMA', company_name: 'Aurobindo Pharma Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'MID_CAP', isin: 'INE406A01037' },
  { symbol: 'TORNTPHARM', company_name: 'Torrent Pharmaceuticals Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'MID_CAP', isin: 'INE685A01028' },
  { symbol: 'ALKEM', company_name: 'Alkem Laboratories Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'MID_CAP', isin: 'INE540L01014' },
  { symbol: 'MAXHEALTH', company_name: 'Max Healthcare Institute Ltd', sector: 'Healthcare', industry: 'Hospitals', market_cap_category: 'MID_CAP', isin: 'INE027H01010' },
  { symbol: 'FORTIS', company_name: 'Fortis Healthcare Ltd', sector: 'Healthcare', industry: 'Hospitals', market_cap_category: 'MID_CAP', isin: 'INE061F01013' },
  { symbol: 'IDFCFIRSTB', company_name: 'IDFC First Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE092T01019' },
  { symbol: 'FEDERALBNK', company_name: 'Federal Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE171A01029' },
  { symbol: 'BANDHANBNK', company_name: 'Bandhan Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE545U01014' },
  { symbol: 'RBLBANK', company_name: 'RBL Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE976G01028' },
  { symbol: 'PNB', company_name: 'Punjab National Bank', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE160A01022' },
  { symbol: 'BANKBARODA', company_name: 'Bank of Baroda', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE028A01039' },
  { symbol: 'CANBK', company_name: 'Canara Bank', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'MID_CAP', isin: 'INE476A01014' },
  { symbol: 'IOC', company_name: 'Indian Oil Corporation Ltd', sector: 'Oil & Gas', industry: 'Refineries', market_cap_category: 'LARGE_CAP', isin: 'INE242A01010' },
  { symbol: 'GAIL', company_name: 'GAIL (India) Ltd', sector: 'Oil & Gas', industry: 'Gas Distribution', market_cap_category: 'MID_CAP', isin: 'INE129A01019' },
  { symbol: 'PETRONET', company_name: 'Petronet LNG Ltd', sector: 'Oil & Gas', industry: 'Gas Distribution', market_cap_category: 'MID_CAP', isin: 'INE347G01014' },
  { symbol: 'TATAPOWER', company_name: 'Tata Power Co Ltd', sector: 'Power', industry: 'Power Generation', market_cap_category: 'MID_CAP', isin: 'INE245A01021' },
  { symbol: 'ADANIGREEN', company_name: 'Adani Green Energy Ltd', sector: 'Power', industry: 'Renewable Energy', market_cap_category: 'LARGE_CAP', isin: 'INE364U01010' },
  { symbol: 'TORNTPOWER', company_name: 'Torrent Power Ltd', sector: 'Power', industry: 'Power Generation', market_cap_category: 'MID_CAP', isin: 'INE813H01021' },
  { symbol: 'NHPC', company_name: 'NHPC Ltd', sector: 'Power', industry: 'Power Generation', market_cap_category: 'MID_CAP', isin: 'INE848E01016' },
  { symbol: 'IRCTC', company_name: 'Indian Railway Catering & Tourism Corporation Ltd', sector: 'Consumer Services', industry: 'Travel Services', market_cap_category: 'MID_CAP', isin: 'INE335Y01020' },
  { symbol: 'INDIANHOTEL', company_name: 'Indian Hotels Co Ltd', sector: 'Consumer Services', industry: 'Hotels', market_cap_category: 'MID_CAP', isin: 'INE053A01029' },
  { symbol: 'LEMON TREE', company_name: 'Lemon Tree Hotels Ltd', sector: 'Consumer Services', industry: 'Hotels', market_cap_category: 'SMALL_CAP', isin: 'INE970X01018' },
  { symbol: 'INDIGO', company_name: 'InterGlobe Aviation Ltd', sector: 'Consumer Services', industry: 'Airlines', market_cap_category: 'MID_CAP', isin: 'INE646L01027' },
  { symbol: 'DLF', company_name: 'DLF Ltd', sector: 'Real Estate', industry: 'Realty', market_cap_category: 'MID_CAP', isin: 'INE271C01023' },
  { symbol: 'GODREJPROP', company_name: 'Godrej Properties Ltd', sector: 'Real Estate', industry: 'Realty', market_cap_category: 'MID_CAP', isin: 'INE484J01027' },
  { symbol: 'OBEROIRLTY', company_name: 'Oberoi Realty Ltd', sector: 'Real Estate', industry: 'Realty', market_cap_category: 'MID_CAP', isin: 'INE093I01010' },
  { symbol: 'PRESTIGE', company_name: 'Prestige Estates Projects Ltd', sector: 'Real Estate', industry: 'Realty', market_cap_category: 'MID_CAP', isin: 'INE811K01011' },
  { symbol: 'LODHA', company_name: 'Macrotech Developers Ltd', sector: 'Real Estate', industry: 'Realty', market_cap_category: 'MID_CAP', isin: 'INE670K01029' },
  { symbol: 'ACC', company_name: 'ACC Ltd', sector: 'Construction Materials', industry: 'Cement', market_cap_category: 'MID_CAP', isin: 'INE012A01025' },
  { symbol: 'AMBUJACEM', company_name: 'Ambuja Cements Ltd', sector: 'Construction Materials', industry: 'Cement', market_cap_category: 'MID_CAP', isin: 'INE079A01024' },
  { symbol: 'SHREECEM', company_name: 'Shree Cement Ltd', sector: 'Construction Materials', industry: 'Cement', market_cap_category: 'MID_CAP', isin: 'INE070A01015' },
  { symbol: 'DALBHARAT', company_name: 'Dalmia Bharat Ltd', sector: 'Construction Materials', industry: 'Cement', market_cap_category: 'MID_CAP', isin: 'INE439L01022' },

  // Small Cap / Others frequently discussed on TV
  { symbol: 'ZEEL', company_name: 'Zee Entertainment Enterprises Ltd', sector: 'Media', industry: 'Broadcasting', market_cap_category: 'SMALL_CAP', isin: 'INE256A01028' },
  { symbol: 'PVR', company_name: 'PVR INOX Ltd', sector: 'Media', industry: 'Entertainment', market_cap_category: 'SMALL_CAP', isin: 'INE191H01014' },
  { symbol: 'IDEA', company_name: 'Vodafone Idea Ltd', sector: 'Telecommunication', industry: 'Telecom Services', market_cap_category: 'SMALL_CAP', isin: 'INE669E01016' },
  { symbol: 'YESBANK', company_name: 'Yes Bank Ltd', sector: 'Financial Services', industry: 'Banks', market_cap_category: 'SMALL_CAP', isin: 'INE528G01035' },
  { symbol: 'SUZLON', company_name: 'Suzlon Energy Ltd', sector: 'Capital Goods', industry: 'Wind Energy', market_cap_category: 'SMALL_CAP', isin: 'INE040H01021' },
  { symbol: 'IRFC', company_name: 'Indian Railway Finance Corporation Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'MID_CAP', isin: 'INE053F01010' },
  { symbol: 'RECLTD', company_name: 'REC Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'MID_CAP', isin: 'INE020B01018' },
  { symbol: 'PFC', company_name: 'Power Finance Corporation Ltd', sector: 'Financial Services', industry: 'NBFC', market_cap_category: 'MID_CAP', isin: 'INE134E01011' },
  { symbol: 'BHEL', company_name: 'Bharat Heavy Electricals Ltd', sector: 'Capital Goods', industry: 'Electrical Equipment', market_cap_category: 'MID_CAP', isin: 'INE257A01026' },
  { symbol: 'HAL', company_name: 'Hindustan Aeronautics Ltd', sector: 'Capital Goods', industry: 'Aerospace & Defense', market_cap_category: 'MID_CAP', isin: 'INE066F01020' },
  { symbol: 'BEL', company_name: 'Bharat Electronics Ltd', sector: 'Capital Goods', industry: 'Aerospace & Defense', market_cap_category: 'MID_CAP', isin: 'INE263A01024' },
  { symbol: 'SAIL', company_name: 'Steel Authority of India Ltd', sector: 'Metals & Mining', industry: 'Steel', market_cap_category: 'MID_CAP', isin: 'INE114A01011' },
  { symbol: 'NMDC', company_name: 'NMDC Ltd', sector: 'Metals & Mining', industry: 'Mining', market_cap_category: 'MID_CAP', isin: 'INE584A01023' },
  { symbol: 'VEDL', company_name: 'Vedanta Ltd', sector: 'Metals & Mining', industry: 'Diversified Metals', market_cap_category: 'MID_CAP', isin: 'INE205A01025' },
  { symbol: 'JINDALSTEL', company_name: 'Jindal Steel & Power Ltd', sector: 'Metals & Mining', industry: 'Steel', market_cap_category: 'MID_CAP', isin: 'INE749A01030' },
  { symbol: 'NATIONALUM', company_name: 'National Aluminium Co Ltd', sector: 'Metals & Mining', industry: 'Aluminium', market_cap_category: 'SMALL_CAP', isin: 'INE139A01034' },
  { symbol: 'GMRINFRA', company_name: 'GMR Airports Infrastructure Ltd', sector: 'Services', industry: 'Infrastructure', market_cap_category: 'SMALL_CAP', isin: 'INE776C01039' },
  { symbol: 'ADANIPOWER', company_name: 'Adani Power Ltd', sector: 'Power', industry: 'Power Generation', market_cap_category: 'MID_CAP', isin: 'INE814H01011' },
  { symbol: 'GLENMARK', company_name: 'Glenmark Pharmaceuticals Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'SMALL_CAP', isin: 'INE935A01035' },
  { symbol: 'NATCOPHARM', company_name: 'Natco Pharma Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'SMALL_CAP', isin: 'INE987B01026' },
  { symbol: 'LAURUSLABS', company_name: 'Laurus Labs Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'SMALL_CAP', isin: 'INE947Q01028' },
  { symbol: 'GRANULES', company_name: 'Granules India Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', market_cap_category: 'SMALL_CAP', isin: 'INE101D01020' },
  { symbol: 'DEEPAKNTR', company_name: 'Deepak Nitrite Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE288B01029' },
  { symbol: 'NAVINFLUOR', company_name: 'Navin Fluorine International Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE048G01026' },
  { symbol: 'CLEAN', company_name: 'Clean Science and Technology Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'SMALL_CAP', isin: 'INE227L01016' },
  { symbol: 'AARTIIND', company_name: 'Aarti Industries Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE769A01020' },
  { symbol: 'FLUOROCHEM', company_name: 'Gujarat Fluorochemicals Ltd', sector: 'Chemicals', industry: 'Specialty Chemicals', market_cap_category: 'MID_CAP', isin: 'INE538A01037' },
  { symbol: 'HAPPSTMNDS', company_name: 'Happiest Minds Technologies Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'SMALL_CAP', isin: 'INE419U01012' },
  { symbol: 'TANLA', company_name: 'Tanla Platforms Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'SMALL_CAP', isin: 'INE483C01032' },
  { symbol: 'ROUTE', company_name: 'Route Mobile Ltd', sector: 'Information Technology', industry: 'IT Services', market_cap_category: 'SMALL_CAP', isin: 'INE450V01013' },
  { symbol: 'SYNGENE', company_name: 'Syngene International Ltd', sector: 'Healthcare', industry: 'Research Services', market_cap_category: 'MID_CAP', isin: 'INE398R01022' },
  { symbol: 'PAYTM', company_name: 'One 97 Communications Ltd', sector: 'Financial Services', industry: 'Fintech', market_cap_category: 'SMALL_CAP', isin: 'INE982J01020' },
  { symbol: 'POLICYBZR', company_name: 'PB Fintech Ltd', sector: 'Financial Services', industry: 'Insurtech', market_cap_category: 'SMALL_CAP', isin: 'INE417T01026' },
  { symbol: 'CARTRADE', company_name: 'CarTrade Tech Ltd', sector: 'Consumer Services', industry: 'Auto Marketplace', market_cap_category: 'SMALL_CAP', isin: 'INE290S01019' },
  { symbol: 'DELHIVERY', company_name: 'Delhivery Ltd', sector: 'Services', industry: 'Logistics', market_cap_category: 'SMALL_CAP', isin: 'INE148O01028' },
  { symbol: 'LTTS', company_name: 'L&T Technology Services Ltd', sector: 'Information Technology', industry: 'Engineering Services', market_cap_category: 'MID_CAP', isin: 'INE010V01017' },
  { symbol: 'CYIENT', company_name: 'Cyient Ltd', sector: 'Information Technology', industry: 'Engineering Services', market_cap_category: 'SMALL_CAP', isin: 'INE136B01020' },
  { symbol: 'TATAELXSI', company_name: 'Tata Elxsi Ltd', sector: 'Information Technology', industry: 'Design Services', market_cap_category: 'MID_CAP', isin: 'INE670A01012' },
  { symbol: 'KPITTECH', company_name: 'KPIT Technologies Ltd', sector: 'Information Technology', industry: 'Engineering Services', market_cap_category: 'MID_CAP', isin: 'INE04I401011' },
  { symbol: 'SONACOMS', company_name: 'Sona BLW Precision Forgings Ltd', sector: 'Automobile', industry: 'Auto Ancillaries', market_cap_category: 'MID_CAP', isin: 'INE073K01018' },
  { symbol: 'INDUSTOWER', company_name: 'Indus Towers Ltd', sector: 'Telecommunication', industry: 'Telecom Infrastructure', market_cap_category: 'MID_CAP', isin: 'INE121J01017' },
  { symbol: 'TATACOMM', company_name: 'Tata Communications Ltd', sector: 'Telecommunication', industry: 'Telecom Services', market_cap_category: 'MID_CAP', isin: 'INE151A01013' },
  { symbol: 'IEX', company_name: 'Indian Energy Exchange Ltd', sector: 'Financial Services', industry: 'Exchange', market_cap_category: 'MID_CAP', isin: 'INE022Q01020' },
  { symbol: 'MCX', company_name: 'Multi Commodity Exchange of India Ltd', sector: 'Financial Services', industry: 'Exchange', market_cap_category: 'MID_CAP', isin: 'INE745G01035' },
  { symbol: 'BSE', company_name: 'BSE Ltd', sector: 'Financial Services', industry: 'Exchange', market_cap_category: 'MID_CAP', isin: 'INE118H01025' },
  { symbol: 'CDSL', company_name: 'Central Depository Services (India) Ltd', sector: 'Financial Services', industry: 'Depository', market_cap_category: 'MID_CAP', isin: 'INE736A01011' },
  { symbol: 'CAMS', company_name: 'Computer Age Management Services Ltd', sector: 'Financial Services', industry: 'RTA Services', market_cap_category: 'SMALL_CAP', isin: 'INE596I01012' },
  { symbol: 'KFINTECH', company_name: 'KFin Technologies Ltd', sector: 'Financial Services', industry: 'RTA Services', market_cap_category: 'SMALL_CAP', isin: 'INE138Y01010' },
];

async function importStocks() {
  console.log('Starting NSE stocks import...');
  console.log(`Total stocks to import: ${NSE_STOCKS.length}`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const stock of NSE_STOCKS) {
    try {
      const result = await pool.query(`
        INSERT INTO stocks (symbol, exchange, company_name, isin, sector, industry, market_cap_category)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol, exchange) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          isin = EXCLUDED.isin,
          sector = EXCLUDED.sector,
          industry = EXCLUDED.industry,
          market_cap_category = EXCLUDED.market_cap_category,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [
        stock.symbol,
        'NSE',
        stock.company_name,
        stock.isin,
        stock.sector,
        stock.industry,
        stock.market_cap_category
      ]);

      if (result.rows[0]?.inserted) {
        imported++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error importing ${stock.symbol}:`, error.message);
      errors++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`New stocks imported: ${imported}`);
  console.log(`Existing stocks updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${NSE_STOCKS.length}`);

  await pool.end();
}

importStocks().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
