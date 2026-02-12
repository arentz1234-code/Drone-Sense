// Commercial Real Estate - Typical Lot Size Reference Guide
// Source: CRE_Lot_Size_Reference.xlsx
// Lot acreage includes building footprint, parking, landscaping, stormwater, and setbacks

export interface LotSizeRequirement {
  id: number;
  tenant: string;
  category: string;
  buildingSF: { min: number; max: number };
  typicalLotAcres: number;
  lotRangeAcres: { min: number; max: number };
  parkingRatio?: string;
  notes?: string;
}

export const LOT_SIZE_CATEGORIES = [
  'BIG BOX / WAREHOUSE RETAIL',
  'GROCERY / SUPERMARKET',
  'DEPARTMENT STORE / MALL ANCHOR',
  'CLUB / FITNESS / ENTERTAINMENT',
  'QUICK-SERVICE RESTAURANT (QSR)',
  'CASUAL / FULL-SERVICE RESTAURANT',
  'CONVENIENCE STORE / GAS STATION',
  'PHARMACY / HEALTH / MEDICAL',
  'BANK / FINANCIAL',
  'DOLLAR STORE / DISCOUNT',
  'AUTO PARTS / SERVICE / DEALERSHIP',
  'HOME IMPROVEMENT / SPECIALTY RETAIL',
  'HOTEL / HOSPITALITY',
  'OFFICE',
  'INDUSTRIAL / WAREHOUSE / DISTRIBUTION',
  'CHILDCARE / EDUCATION',
  'MULTI-FAMILY RESIDENTIAL',
  'STRIP CENTER / MULTI-TENANT',
  'MISCELLANEOUS',
] as const;

export type LotSizeCategory = typeof LOT_SIZE_CATEGORIES[number];

export const LOT_SIZE_REFERENCE: LotSizeRequirement[] = [
  // BIG BOX / WAREHOUSE RETAIL
  { id: 1, tenant: 'Walmart Supercenter', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 180000, max: 260000 }, typicalLotAcres: 20, lotRangeAcres: { min: 15, max: 25 }, parkingRatio: '5.0/1,000 SF', notes: 'Includes garden center, fuel station, grocery pickup' },
  { id: 2, tenant: 'Walmart (Grocery Only / Neighborhood Market)', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 40000, max: 65000 }, typicalLotAcres: 6, lotRangeAcres: { min: 4, max: 8 }, parkingRatio: '5.0/1,000 SF', notes: 'Smaller format, urban/suburban infill' },
  { id: 3, tenant: "Sam's Club", category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 130000, max: 160000 }, typicalLotAcres: 14, lotRangeAcres: { min: 12, max: 18 }, parkingRatio: '5.0/1,000 SF', notes: 'Warehouse format, requires truck access' },
  { id: 4, tenant: 'Costco', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 145000, max: 160000 }, typicalLotAcres: 16, lotRangeAcres: { min: 14, max: 20 }, parkingRatio: '5.5/1,000 SF', notes: 'Fuel station adds 0.5 - 1.0 ac, tire center common' },
  { id: 5, tenant: 'Target', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 125000, max: 175000 }, typicalLotAcres: 11, lotRangeAcres: { min: 9, max: 14 }, parkingRatio: '4.5/1,000 SF', notes: 'SuperTarget with grocery at high end' },
  { id: 6, tenant: 'Target (Small Format)', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 20000, max: 40000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, parkingRatio: '4.0/1,000 SF', notes: 'Urban locations, college towns' },
  { id: 7, tenant: 'Home Depot', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 105000, max: 140000 }, typicalLotAcres: 11, lotRangeAcres: { min: 9, max: 14 }, parkingRatio: '4.5/1,000 SF', notes: 'Includes outdoor garden center and lumber yard' },
  { id: 8, tenant: "Lowe's", category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 105000, max: 140000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 15 }, parkingRatio: '4.5/1,000 SF', notes: 'Similar to Home Depot, sometimes larger garden' },
  { id: 9, tenant: 'Menards', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 150000, max: 230000 }, typicalLotAcres: 15, lotRangeAcres: { min: 12, max: 20 }, parkingRatio: '4.5/1,000 SF', notes: 'Midwest, often larger lots with yard storage' },
  { id: 10, tenant: 'IKEA', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 300000, max: 450000 }, typicalLotAcres: 25, lotRangeAcres: { min: 20, max: 35 }, parkingRatio: '5.0/1,000 SF', notes: 'Massive footprint, structured parking common' },
  { id: 11, tenant: "Bass Pro Shops / Cabela's", category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 100000, max: 200000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 18 }, parkingRatio: '4.5/1,000 SF', notes: 'Destination retail, often near interstate' },
  { id: 12, tenant: 'Floor & Decor', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 75000, max: 80000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 10 }, parkingRatio: '3.5/1,000 SF', notes: 'Warehouse format, loading dock required' },
  { id: 13, tenant: 'At Home', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 80000, max: 110000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 10 }, parkingRatio: '3.5/1,000 SF', notes: 'Often backfills former big box spaces' },
  { id: 14, tenant: "BJ's Wholesale Club", category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 100000, max: 120000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 15 }, parkingRatio: '5.0/1,000 SF', notes: 'Fuel station typical' },
  { id: 15, tenant: 'Tractor Supply Co.', category: 'BIG BOX / WAREHOUSE RETAIL', buildingSF: { min: 15000, max: 22000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2, max: 4 }, parkingRatio: '4.0/1,000 SF', notes: 'Outdoor display and fenced storage area' },

  // GROCERY / SUPERMARKET
  { id: 16, tenant: 'Kroger', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 65000, max: 125000 }, typicalLotAcres: 7, lotRangeAcres: { min: 5, max: 10 }, parkingRatio: '5.0/1,000 SF', notes: 'Marketplace format at high end with fuel' },
  { id: 17, tenant: 'Publix', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 45000, max: 56000 }, typicalLotAcres: 5, lotRangeAcres: { min: 4, max: 7 }, parkingRatio: '5.0/1,000 SF', notes: 'Often anchors strip center, fuel at some' },
  { id: 18, tenant: 'H-E-B', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 75000, max: 120000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 12 }, parkingRatio: '5.0/1,000 SF', notes: 'Plus format at high end' },
  { id: 19, tenant: 'Aldi', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 12000, max: 22000 }, typicalLotAcres: 1.8, lotRangeAcres: { min: 1.5, max: 2.5 }, parkingRatio: '5.0/1,000 SF', notes: 'Compact format, efficient layout' },
  { id: 20, tenant: 'Lidl', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 20000, max: 36000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2.0, max: 4.0 }, parkingRatio: '5.0/1,000 SF', notes: 'European-style discount grocery' },
  { id: 21, tenant: "Trader Joe's", category: 'GROCERY / SUPERMARKET', buildingSF: { min: 10000, max: 15000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Often in existing retail centers' },
  { id: 22, tenant: 'Whole Foods Market', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 25000, max: 65000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 6 }, parkingRatio: '5.0/1,000 SF', notes: 'Higher-end location, mixed-use common' },
  { id: 23, tenant: 'Sprouts Farmers Market', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 23000, max: 30000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2, max: 4 }, parkingRatio: '5.0/1,000 SF', notes: 'End-cap or inline anchor' },
  { id: 24, tenant: 'WinCo Foods', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 85000, max: 95000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 10 }, parkingRatio: '5.0/1,000 SF', notes: 'Bulk/warehouse grocery, West Coast' },
  { id: 25, tenant: 'Food Lion', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 28000, max: 45000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 5 }, parkingRatio: '5.0/1,000 SF', notes: 'Southeast regional' },
  { id: 26, tenant: 'Piggly Wiggly', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 15000, max: 30000 }, typicalLotAcres: 2.5, lotRangeAcres: { min: 2, max: 4 }, parkingRatio: '5.0/1,000 SF', notes: 'Smaller community grocery, Southeast' },
  { id: 27, tenant: 'Save-A-Lot', category: 'GROCERY / SUPERMARKET', buildingSF: { min: 15000, max: 17000 }, typicalLotAcres: 1.8, lotRangeAcres: { min: 1.5, max: 2.5 }, parkingRatio: '5.0/1,000 SF', notes: 'Discount grocery, smaller footprint' },

  // DEPARTMENT STORE / MALL ANCHOR
  { id: 28, tenant: "Macy's (Freestanding)", category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 100000, max: 200000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 18 }, parkingRatio: '4.5/1,000 SF', notes: 'Freestanding rare, typically mall anchor' },
  { id: 29, tenant: 'Nordstrom', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 120000, max: 200000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 16 }, parkingRatio: '5.0/1,000 SF', notes: 'Usually mall-anchored, Rack is smaller' },
  { id: 30, tenant: 'Nordstrom Rack', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 30000, max: 40000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 5 }, parkingRatio: '5.0/1,000 SF', notes: 'Strip center or power center' },
  { id: 31, tenant: "Dillard's", category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 100000, max: 250000 }, typicalLotAcres: 13, lotRangeAcres: { min: 10, max: 18 }, parkingRatio: '4.5/1,000 SF', notes: 'Mall anchor, often multi-level' },
  { id: 32, tenant: 'JCPenney', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 80000, max: 150000 }, typicalLotAcres: 10, lotRangeAcres: { min: 8, max: 14 }, parkingRatio: '4.5/1,000 SF', notes: 'Mall anchor or freestanding' },
  { id: 33, tenant: "Kohl's", category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 80000, max: 90000 }, typicalLotAcres: 9, lotRangeAcres: { min: 7, max: 11 }, parkingRatio: '5.0/1,000 SF', notes: 'Typically freestanding or power center' },
  { id: 34, tenant: 'TJ Maxx / Marshalls / HomeGoods', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 22000, max: 30000 }, typicalLotAcres: 3.5, lotRangeAcres: { min: 2.5, max: 5.0 }, parkingRatio: '4.5/1,000 SF', notes: 'Combo store at 55,000+ SF, inline or end-cap' },
  { id: 35, tenant: 'Ross Dress for Less', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 22000, max: 30000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2.5, max: 4.5 }, parkingRatio: '4.5/1,000 SF', notes: 'Similar format to TJ Maxx' },
  { id: 36, tenant: 'Burlington', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 40000, max: 80000 }, typicalLotAcres: 6, lotRangeAcres: { min: 4, max: 8 }, parkingRatio: '4.0/1,000 SF', notes: 'Often backfills vacated grocery/dept stores' },
  { id: 37, tenant: 'Five Below', category: 'DEPARTMENT STORE / MALL ANCHOR', buildingSF: { min: 8000, max: 10000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 0.8, max: 1.5 }, parkingRatio: '4.5/1,000 SF', notes: 'Inline tenant, strip center' },

  // CLUB / FITNESS / ENTERTAINMENT
  { id: 38, tenant: 'Planet Fitness', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 15000, max: 20000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, parkingRatio: '5.5/1,000 SF', notes: 'Often second-gen retail space' },
  { id: 39, tenant: 'LA Fitness / Esporta', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 40000, max: 50000 }, typicalLotAcres: 5, lotRangeAcres: { min: 4, max: 7 }, parkingRatio: '5.5/1,000 SF', notes: 'Pool and courts increase footprint' },
  { id: 40, tenant: 'Lifetime Fitness', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 100000, max: 130000 }, typicalLotAcres: 12, lotRangeAcres: { min: 10, max: 16 }, parkingRatio: '5.0/1,000 SF', notes: 'Premium campus, outdoor pools, courts' },
  { id: 41, tenant: 'Topgolf', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 65000, max: 65000 }, typicalLotAcres: 13, lotRangeAcres: { min: 10, max: 15 }, parkingRatio: '4.0/1,000 SF', notes: 'Driving range + building, unique site needs' },
  { id: 42, tenant: "Dave & Buster's", category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 25000, max: 40000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 5 }, parkingRatio: '6.0/1,000 SF', notes: 'Higher parking for entertainment use' },
  { id: 43, tenant: 'Main Event', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 50000, max: 55000 }, typicalLotAcres: 6, lotRangeAcres: { min: 5, max: 8 }, parkingRatio: '5.5/1,000 SF', notes: 'Bowling, arcade, food, laser tag' },
  { id: 44, tenant: 'Movie Theater (AMC/Regal, 12-16 screen)', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 50000, max: 80000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 12 }, parkingRatio: '3.0/seat', notes: 'Stadium seating, IMAX adds footprint' },
  { id: 45, tenant: 'Chuck E. Cheese', category: 'CLUB / FITNESS / ENTERTAINMENT', buildingSF: { min: 12000, max: 14000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, parkingRatio: '6.0/1,000 SF', notes: 'Inline or end-cap' },

  // QUICK-SERVICE RESTAURANT (QSR)
  { id: 46, tenant: "McDonald's", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 4000, max: 4500 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 1.0 }, notes: 'Drive-thru stacking is primary driver' },
  { id: 47, tenant: 'Chick-fil-A', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 5000, max: 5000 }, typicalLotAcres: 1, lotRangeAcres: { min: 0.8, max: 1.5 }, notes: 'Double drive-thru requires more queuing' },
  { id: 48, tenant: 'Starbucks (Drive-Thru)', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 2000, max: 2500 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.4, max: 0.8 }, notes: 'Pad site, drive-thru stacking critical' },
  { id: 49, tenant: "Dunkin'", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 1800, max: 2500 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.4, max: 0.8 }, notes: 'Pad site with drive-thru' },
  { id: 50, tenant: 'Taco Bell', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 2500, max: 3000 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.5, max: 0.8 }, notes: 'Cantina format slightly smaller' },
  { id: 51, tenant: "Wendy's", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 3500, max: 4000 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 0.9 }, notes: 'Standard pad site with drive-thru' },
  { id: 52, tenant: 'Burger King', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 3500, max: 4200 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 0.9 }, notes: 'Standard pad site' },
  { id: 53, tenant: 'Popeyes', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 2500, max: 3000 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.5, max: 0.8 }, notes: 'Drive-thru standard' },
  { id: 54, tenant: "Zaxby's", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 3500, max: 4000 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.6, max: 1.0 }, notes: 'Southeast regional QSR' },
  { id: 55, tenant: "Raising Cane's", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 3500, max: 3800 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.6, max: 1.0 }, notes: 'High volume, double lane common' },
  { id: 56, tenant: 'Whataburger', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 4000, max: 4500 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.6, max: 1.0 }, notes: 'South/Southeast' },
  { id: 57, tenant: 'Sonic Drive-In', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 1600, max: 1800 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.6, max: 1.0 }, notes: 'Stall parking replaces traditional parking' },
  { id: 58, tenant: 'Wingstop', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 1500, max: 1800 }, typicalLotAcres: 0.3, lotRangeAcres: { min: 0.2, max: 0.5 }, notes: 'Inline, heavy delivery/takeout' },
  { id: 59, tenant: 'Chipotle', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 2200, max: 2500 }, typicalLotAcres: 0.5, lotRangeAcres: { min: 0.4, max: 0.7 }, notes: 'Chipotlane drive-thru newer prototype' },
  { id: 60, tenant: 'Panda Express', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 2200, max: 2500 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.4, max: 0.8 }, notes: 'Drive-thru or end-cap' },
  { id: 61, tenant: "Culver's", category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 4200, max: 4600 }, typicalLotAcres: 0.9, lotRangeAcres: { min: 0.7, max: 1.2 }, notes: 'Larger footprint, double drive-thru' },
  { id: 62, tenant: 'Cook Out', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 1000, max: 1500 }, typicalLotAcres: 0.6, lotRangeAcres: { min: 0.4, max: 0.8 }, notes: 'Southeast, walk-up + drive-thru' },
  { id: 63, tenant: 'Panera Bread', category: 'QUICK-SERVICE RESTAURANT (QSR)', buildingSF: { min: 4000, max: 4600 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 1.0 }, notes: 'Rapid Pick-Up lane newer locations' },

  // CASUAL / FULL-SERVICE RESTAURANT
  { id: 64, tenant: "Chili's / Applebee's", category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 5500, max: 6500 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 1.0, max: 1.5 }, parkingRatio: '10/1,000 SF', notes: 'Pad site with patio' },
  { id: 65, tenant: 'Olive Garden / Red Lobster', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 7000, max: 8500 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.2, max: 2.0 }, parkingRatio: '10/1,000 SF', notes: 'Darden concepts, higher seating' },
  { id: 66, tenant: 'Texas Roadhouse', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 7000, max: 7500 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.2, max: 2.0 }, parkingRatio: '10/1,000 SF', notes: 'High volume, large parking needed' },
  { id: 67, tenant: 'Cracker Barrel', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 9000, max: 10000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 2.5 }, parkingRatio: '10/1,000 SF', notes: 'Restaurant + retail store, RV parking' },
  { id: 68, tenant: 'Waffle House', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 1600, max: 1800 }, typicalLotAcres: 0.4, lotRangeAcres: { min: 0.3, max: 0.5 }, parkingRatio: '10/1,000 SF', notes: 'Very compact, no drive-thru' },
  { id: 69, tenant: "IHOP / Denny's", category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 4500, max: 5000 }, typicalLotAcres: 0.9, lotRangeAcres: { min: 0.7, max: 1.2 }, parkingRatio: '10/1,000 SF', notes: 'Standard sit-down pad' },
  { id: 70, tenant: 'Buffalo Wild Wings', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 5500, max: 7000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 1.0, max: 1.5 }, parkingRatio: '10/1,000 SF', notes: 'End-cap or pad site' },
  { id: 71, tenant: "Cheddar's Scratch Kitchen", category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 7500, max: 8000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.2, max: 1.8 }, parkingRatio: '10/1,000 SF', notes: 'Darden concept' },
  { id: 72, tenant: 'LongHorn Steakhouse', category: 'CASUAL / FULL-SERVICE RESTAURANT', buildingSF: { min: 6000, max: 6500 }, typicalLotAcres: 1.3, lotRangeAcres: { min: 1.0, max: 1.5 }, parkingRatio: '10/1,000 SF', notes: 'Darden concept' },

  // CONVENIENCE STORE / GAS STATION
  { id: 73, tenant: "Buc-ee's", category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 50000, max: 75000 }, typicalLotAcres: 15, lotRangeAcres: { min: 10, max: 25 }, notes: '100+ fuel pumps, massive footprint' },
  { id: 74, tenant: 'QuikTrip (QT)', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 5000, max: 6000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 2.5 }, notes: '24 pumps typical, travel center larger' },
  { id: 75, tenant: 'RaceTrac', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 5000, max: 6500 }, typicalLotAcres: 1.8, lotRangeAcres: { min: 1.5, max: 2.5 }, notes: 'Southeast, similar to QT' },
  { id: 76, tenant: 'Wawa', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 5800, max: 6000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.2, max: 2.0 }, notes: 'Mid-Atlantic/Southeast, fuel + food' },
  { id: 77, tenant: 'Sheetz', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 5500, max: 6500 }, typicalLotAcres: 1.8, lotRangeAcres: { min: 1.5, max: 2.5 }, notes: 'Mid-Atlantic, MTO food focus' },
  { id: 78, tenant: '7-Eleven / Circle K (Standard)', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 2500, max: 3500 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.5, max: 1.2 }, notes: '8-12 pumps typical' },
  { id: 79, tenant: "Love's Travel Stop", category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 10000, max: 15000 }, typicalLotAcres: 8, lotRangeAcres: { min: 5, max: 15 }, notes: 'Truck parking, showers, scales' },
  { id: 80, tenant: 'Pilot / Flying J', category: 'CONVENIENCE STORE / GAS STATION', buildingSF: { min: 10000, max: 15000 }, typicalLotAcres: 10, lotRangeAcres: { min: 7, max: 18 }, notes: 'Interstate, major truck stop' },

  // PHARMACY / HEALTH / MEDICAL
  { id: 81, tenant: 'CVS Pharmacy', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 10000, max: 13000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Drive-thru pharmacy, corner preferred' },
  { id: 82, tenant: 'Walgreens', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 14000, max: 15000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Corner pad site, drive-thru' },
  { id: 83, tenant: 'Urgent Care / Walk-In Clinic', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 3500, max: 5000 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.5, max: 1.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Pad site or end-cap' },
  { id: 84, tenant: 'Dental Office (Multi-provider)', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 3000, max: 6000 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 1.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Professional park or retail pad' },
  { id: 85, tenant: 'Dialysis Center (DaVita/Fresenius)', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 8000, max: 10000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 0.8, max: 1.5 }, parkingRatio: '4.0/1,000 SF', notes: 'Single-story, inline or freestanding' },
  { id: 86, tenant: 'Freestanding Emergency Room', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 10000, max: 15000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, parkingRatio: '5.0/1,000 SF', notes: 'Signalized intersection preferred' },
  { id: 87, tenant: 'Medical Office Building (MOB)', category: 'PHARMACY / HEALTH / MEDICAL', buildingSF: { min: 20000, max: 60000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2.0, max: 5.0 }, parkingRatio: '4.5/1,000 SF', notes: 'Multi-story reduces lot size' },

  // BANK / FINANCIAL
  { id: 88, tenant: 'Bank Branch (Chase, Wells Fargo, etc.)', category: 'BANK / FINANCIAL', buildingSF: { min: 3500, max: 5000 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.5, max: 1.2 }, parkingRatio: '4.0/1,000 SF', notes: 'Drive-thru lanes, corner lot preferred' },
  { id: 89, tenant: 'Credit Union Branch', category: 'BANK / FINANCIAL', buildingSF: { min: 3000, max: 5000 }, typicalLotAcres: 0.7, lotRangeAcres: { min: 0.5, max: 1.0 }, parkingRatio: '4.0/1,000 SF', notes: 'Similar to bank, sometimes smaller' },

  // DOLLAR STORE / DISCOUNT
  { id: 90, tenant: 'Dollar General', category: 'DOLLAR STORE / DISCOUNT', buildingSF: { min: 9000, max: 10000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 0.8, max: 1.5 }, parkingRatio: '4.0/1,000 SF', notes: 'Rural/suburban, often gravel lot' },
  { id: 91, tenant: 'Dollar Tree / Family Dollar', category: 'DOLLAR STORE / DISCOUNT', buildingSF: { min: 9000, max: 12000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 0.8, max: 1.5 }, parkingRatio: '4.0/1,000 SF', notes: 'Combo stores at 15,000+ SF' },
  { id: 92, tenant: "Ollie's Bargain Outlet", category: 'DOLLAR STORE / DISCOUNT', buildingSF: { min: 30000, max: 35000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 5 }, parkingRatio: '4.0/1,000 SF', notes: 'Often second-gen space' },

  // AUTO PARTS / SERVICE / DEALERSHIP
  { id: 93, tenant: "AutoZone / O'Reilly / Advance Auto", category: 'AUTO PARTS / SERVICE / DEALERSHIP', buildingSF: { min: 6500, max: 7500 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.6, max: 1.0 }, parkingRatio: '4.0/1,000 SF', notes: 'Pad site, drive-up hub door' },
  { id: 94, tenant: 'Jiffy Lube / Take 5 Oil Change', category: 'AUTO PARTS / SERVICE / DEALERSHIP', buildingSF: { min: 2000, max: 3000 }, typicalLotAcres: 0.5, lotRangeAcres: { min: 0.3, max: 0.7 }, notes: 'Service bays, no traditional parking' },
  { id: 95, tenant: 'Car Wash (Express Tunnel)', category: 'AUTO PARTS / SERVICE / DEALERSHIP', buildingSF: { min: 4000, max: 5000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, notes: '140-ft tunnel + vacuum + stacking' },
  { id: 96, tenant: 'Tire Shop (Discount Tire)', category: 'AUTO PARTS / SERVICE / DEALERSHIP', buildingSF: { min: 7000, max: 8000 }, typicalLotAcres: 1, lotRangeAcres: { min: 0.7, max: 1.5 }, notes: 'Service bays + tire inventory' },
  { id: 97, tenant: 'Auto Dealership (New Car)', category: 'AUTO PARTS / SERVICE / DEALERSHIP', buildingSF: { min: 15000, max: 30000 }, typicalLotAcres: 7, lotRangeAcres: { min: 5, max: 12 }, notes: 'Display lot is primary land driver' },

  // HOME IMPROVEMENT / SPECIALTY RETAIL
  { id: 98, tenant: 'Best Buy', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 35000, max: 45000 }, typicalLotAcres: 5, lotRangeAcres: { min: 4, max: 7 }, parkingRatio: '5.0/1,000 SF', notes: 'Shrinking footprint trend' },
  { id: 99, tenant: 'PetSmart / Petco', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 12000, max: 18000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, parkingRatio: '4.5/1,000 SF', notes: 'Often end-cap of strip center' },
  { id: 100, tenant: 'Michaels / Hobby Lobby', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 40000, max: 55000 }, typicalLotAcres: 5, lotRangeAcres: { min: 4, max: 7 }, parkingRatio: '4.0/1,000 SF', notes: 'Power center or strip anchor' },
  { id: 101, tenant: "Dick's Sporting Goods", category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 40000, max: 50000 }, typicalLotAcres: 5.5, lotRangeAcres: { min: 4, max: 7 }, parkingRatio: '4.5/1,000 SF', notes: 'House of Sport format up to 100K SF' },
  { id: 102, tenant: 'Academy Sports', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 60000, max: 65000 }, typicalLotAcres: 7, lotRangeAcres: { min: 5, max: 9 }, parkingRatio: '4.5/1,000 SF', notes: 'South/Southeast, outdoor display' },
  { id: 103, tenant: 'Mattress Firm / Sleep Number', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 4000, max: 5000 }, typicalLotAcres: 0.5, lotRangeAcres: { min: 0.3, max: 0.7 }, parkingRatio: '3.5/1,000 SF', notes: 'Inline or small pad' },
  { id: 104, tenant: "Aaron's / Rent-A-Center", category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 5000, max: 8000 }, typicalLotAcres: 0.8, lotRangeAcres: { min: 0.5, max: 1.0 }, parkingRatio: '3.5/1,000 SF', notes: 'Delivery fleet parking needed' },
  { id: 105, tenant: 'Ulta Beauty', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 10000, max: 12000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.0 }, parkingRatio: '5.0/1,000 SF', notes: 'End-cap preferred' },
  { id: 106, tenant: 'Bath & Body Works', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 3000, max: 4000 }, typicalLotAcres: 0.4, lotRangeAcres: { min: 0.3, max: 0.6 }, parkingRatio: '4.5/1,000 SF', notes: 'Inline tenant' },
  { id: 107, tenant: 'HomeGoods (standalone)', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 22000, max: 25000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2.5, max: 4.0 }, parkingRatio: '4.5/1,000 SF', notes: 'End-cap or freestanding' },
  { id: 108, tenant: 'Staples / Office Depot', category: 'HOME IMPROVEMENT / SPECIALTY RETAIL', buildingSF: { min: 18000, max: 24000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2, max: 4 }, parkingRatio: '4.0/1,000 SF', notes: 'Shrinking footprint, many closing' },

  // HOTEL / HOSPITALITY
  { id: 109, tenant: 'Select Service Hotel (Hampton Inn, 80-120 keys)', category: 'HOTEL / HOSPITALITY', buildingSF: { min: 45000, max: 65000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, parkingRatio: '1.0/key', notes: '3-5 stories, surface parking' },
  { id: 110, tenant: 'Extended Stay (Residence Inn, 100+ keys)', category: 'HOTEL / HOSPITALITY', buildingSF: { min: 55000, max: 80000 }, typicalLotAcres: 2.5, lotRangeAcres: { min: 2.0, max: 3.5 }, parkingRatio: '1.0/key', notes: 'Suite-style, longer stays' },
  { id: 111, tenant: 'Economy Hotel (Holiday Inn Express, 80 keys)', category: 'HOTEL / HOSPITALITY', buildingSF: { min: 35000, max: 50000 }, typicalLotAcres: 1.8, lotRangeAcres: { min: 1.5, max: 2.5 }, parkingRatio: '1.0/key', notes: '3-4 stories' },
  { id: 112, tenant: 'Full-Service Hotel (Marriott, 200+ keys)', category: 'HOTEL / HOSPITALITY', buildingSF: { min: 120000, max: 200000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 6 }, parkingRatio: '0.8/key', notes: 'Ballroom, restaurant, structured parking' },

  // OFFICE
  { id: 113, tenant: 'Small Office Building (Class B)', category: 'OFFICE', buildingSF: { min: 10000, max: 20000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.5 }, parkingRatio: '4.0/1,000 SF', notes: 'Professional/medical park' },
  { id: 114, tenant: 'Mid-Rise Office (Class A, 3-5 stories)', category: 'OFFICE', buildingSF: { min: 50000, max: 150000 }, typicalLotAcres: 4, lotRangeAcres: { min: 3, max: 6 }, parkingRatio: '3.5/1,000 SF', notes: 'Structured parking reduces lot' },
  { id: 115, tenant: 'Suburban Office Campus', category: 'OFFICE', buildingSF: { min: 200000, max: 500000 }, typicalLotAcres: 15, lotRangeAcres: { min: 10, max: 30 }, parkingRatio: '3.5/1,000 SF', notes: 'Multi-building, amenity-rich' },

  // INDUSTRIAL / WAREHOUSE / DISTRIBUTION
  { id: 116, tenant: 'Small Industrial / Flex Space', category: 'INDUSTRIAL / WAREHOUSE / DISTRIBUTION', buildingSF: { min: 10000, max: 30000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 4.0 }, parkingRatio: '1.5/1,000 SF', notes: 'Office + warehouse combo' },
  { id: 117, tenant: 'Standard Warehouse / Distribution', category: 'INDUSTRIAL / WAREHOUSE / DISTRIBUTION', buildingSF: { min: 100000, max: 250000 }, typicalLotAcres: 15, lotRangeAcres: { min: 10, max: 25 }, parkingRatio: 'Dock doors', notes: '36-ft clear height, truck courts' },
  { id: 118, tenant: 'Large Distribution Center (Amazon-scale)', category: 'INDUSTRIAL / WAREHOUSE / DISTRIBUTION', buildingSF: { min: 500000, max: 1200000 }, typicalLotAcres: 80, lotRangeAcres: { min: 50, max: 150 }, parkingRatio: 'Dock doors', notes: 'Employee parking, trailer storage' },
  { id: 119, tenant: 'Self-Storage Facility', category: 'INDUSTRIAL / WAREHOUSE / DISTRIBUTION', buildingSF: { min: 50000, max: 80000 }, typicalLotAcres: 3, lotRangeAcres: { min: 2, max: 5 }, notes: 'Multi-story reduces acreage' },
  { id: 120, tenant: 'Truck Terminal / Cross-Dock', category: 'INDUSTRIAL / WAREHOUSE / DISTRIBUTION', buildingSF: { min: 20000, max: 50000 }, typicalLotAcres: 10, lotRangeAcres: { min: 5, max: 15 }, notes: 'Dock-door intensive, staging yard' },

  // CHILDCARE / EDUCATION
  { id: 121, tenant: 'Childcare Center (KinderCare, Primrose)', category: 'CHILDCARE / EDUCATION', buildingSF: { min: 8000, max: 12000 }, typicalLotAcres: 1.2, lotRangeAcres: { min: 0.8, max: 2.0 }, notes: 'Outdoor play area required by code' },
  { id: 122, tenant: 'Charter / Private School (K-8)', category: 'CHILDCARE / EDUCATION', buildingSF: { min: 30000, max: 60000 }, typicalLotAcres: 5, lotRangeAcres: { min: 3, max: 10 }, notes: 'Fields, carpool loop, parking' },

  // MULTI-FAMILY RESIDENTIAL
  { id: 123, tenant: 'Garden-Style Apartments (200 units)', category: 'MULTI-FAMILY RESIDENTIAL', buildingSF: { min: 200000, max: 200000 }, typicalLotAcres: 12, lotRangeAcres: { min: 8, max: 18 }, parkingRatio: '1.5/unit', notes: '2-3 stories, surface parking, pool/amenity' },
  { id: 124, tenant: 'Mid-Rise Apartments (250 units, 4-5 story)', category: 'MULTI-FAMILY RESIDENTIAL', buildingSF: { min: 250000, max: 250000 }, typicalLotAcres: 5, lotRangeAcres: { min: 3, max: 8 }, parkingRatio: '1.2/unit', notes: 'Structured parking reduces footprint' },
  { id: 125, tenant: 'Townhome Community (100 units)', category: 'MULTI-FAMILY RESIDENTIAL', buildingSF: { min: 150000, max: 150000 }, typicalLotAcres: 12, lotRangeAcres: { min: 8, max: 18 }, parkingRatio: '2.0/unit', notes: 'Attached units with small yards' },

  // STRIP CENTER / MULTI-TENANT
  { id: 126, tenant: 'Small Strip Center (5,000 - 15,000 SF)', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 5000, max: 15000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.5 }, parkingRatio: '4.5/1,000 SF', notes: 'Small shop pad, 3-6 bays' },
  { id: 127, tenant: 'Neighborhood Center (50,000 - 100,000 SF)', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 50000, max: 100000 }, typicalLotAcres: 8, lotRangeAcres: { min: 6, max: 12 }, parkingRatio: '4.5/1,000 SF', notes: 'Grocery-anchored typical' },
  { id: 128, tenant: 'Community Center (100,000 - 300,000 SF)', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 100000, max: 300000 }, typicalLotAcres: 20, lotRangeAcres: { min: 15, max: 30 }, parkingRatio: '4.5/1,000 SF', notes: 'Multiple anchors, junior anchors' },
  { id: 129, tenant: 'Power Center (250,000 - 600,000 SF)', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 250000, max: 600000 }, typicalLotAcres: 35, lotRangeAcres: { min: 25, max: 50 }, parkingRatio: '4.5/1,000 SF', notes: 'Multiple big box tenants' },
  { id: 130, tenant: 'Lifestyle Center / Open-Air Mall', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 300000, max: 600000 }, typicalLotAcres: 40, lotRangeAcres: { min: 30, max: 60 }, parkingRatio: '4.5/1,000 SF', notes: 'Upscale, walkable, restaurants' },
  { id: 131, tenant: 'Regional Mall (Enclosed)', category: 'STRIP CENTER / MULTI-TENANT', buildingSF: { min: 500000, max: 1500000 }, typicalLotAcres: 60, lotRangeAcres: { min: 40, max: 100 }, parkingRatio: '5.0/1,000 SF', notes: '4-5 anchors, food court, multi-level' },

  // MISCELLANEOUS
  { id: 132, tenant: 'Church / House of Worship (500 seats)', category: 'MISCELLANEOUS', buildingSF: { min: 15000, max: 25000 }, typicalLotAcres: 5, lotRangeAcres: { min: 3, max: 8 }, parkingRatio: '0.33/seat', notes: 'Sunday peak parking' },
  { id: 133, tenant: 'Megachurch (2,000+ seats)', category: 'MISCELLANEOUS', buildingSF: { min: 50000, max: 150000 }, typicalLotAcres: 25, lotRangeAcres: { min: 15, max: 40 }, parkingRatio: '0.33/seat', notes: 'Campus with education, rec' },
  { id: 134, tenant: 'Fire Station', category: 'MISCELLANEOUS', buildingSF: { min: 8000, max: 15000 }, typicalLotAcres: 2, lotRangeAcres: { min: 1.5, max: 3.0 }, notes: 'Apparatus bays drive footprint' },
  { id: 135, tenant: 'U-Haul / Public Storage (multi-story)', category: 'MISCELLANEOUS', buildingSF: { min: 80000, max: 120000 }, typicalLotAcres: 2.5, lotRangeAcres: { min: 1.5, max: 4.0 }, notes: '4-5 stories in urban areas' },
  { id: 136, tenant: 'Collision Center / Body Shop', category: 'MISCELLANEOUS', buildingSF: { min: 10000, max: 20000 }, typicalLotAcres: 1.5, lotRangeAcres: { min: 1.0, max: 2.5 }, notes: 'Outdoor vehicle storage' },
];

// Helper function to find matching tenants for a given lot size
export function findMatchingTenants(lotAcres: number): LotSizeRequirement[] {
  return LOT_SIZE_REFERENCE.filter(req =>
    lotAcres >= req.lotRangeAcres.min && lotAcres <= req.lotRangeAcres.max
  ).sort((a, b) => {
    // Sort by how close the typical lot size is to the given lot
    const aDiff = Math.abs(a.typicalLotAcres - lotAcres);
    const bDiff = Math.abs(b.typicalLotAcres - lotAcres);
    return aDiff - bDiff;
  });
}

// Helper function to find tenants by category
export function findTenantsByCategory(category: LotSizeCategory): LotSizeRequirement[] {
  return LOT_SIZE_REFERENCE.filter(req => req.category === category);
}

// Helper function to check if a specific tenant fits a lot
export function doesTenantFitLot(tenantName: string, lotAcres: number): { fits: boolean; matchQuality: 'ideal' | 'acceptable' | 'tight' | 'too_small' | 'too_large' } {
  const tenant = LOT_SIZE_REFERENCE.find(t =>
    t.tenant.toLowerCase().includes(tenantName.toLowerCase()) ||
    tenantName.toLowerCase().includes(t.tenant.toLowerCase())
  );

  if (!tenant) {
    return { fits: false, matchQuality: 'too_small' };
  }

  if (lotAcres < tenant.lotRangeAcres.min) {
    return { fits: false, matchQuality: 'too_small' };
  }

  if (lotAcres > tenant.lotRangeAcres.max * 1.5) {
    return { fits: true, matchQuality: 'too_large' };
  }

  if (lotAcres >= tenant.typicalLotAcres * 0.9 && lotAcres <= tenant.typicalLotAcres * 1.1) {
    return { fits: true, matchQuality: 'ideal' };
  }

  if (lotAcres >= tenant.lotRangeAcres.min && lotAcres <= tenant.lotRangeAcres.max) {
    return { fits: true, matchQuality: 'acceptable' };
  }

  return { fits: true, matchQuality: 'tight' };
}

export default LOT_SIZE_REFERENCE;
