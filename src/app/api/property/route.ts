import { NextResponse } from 'next/server';

interface PropertyRequest {
  address: string;
}

export interface PropertyData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  lotSize: string;
  lotSizeAcres: string;
  zoning: string;
  landUse: string;
  yearBuilt: string;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  assessedValue: string;
  taxAmount: string;
  lastSaleDate: string;
  lastSalePrice: string;
  ownerName: string;
  ownerType: string;
  propertyType: string;
  stories: string;
  garage: string;
  listPrice: string;
  status: string;
}

export async function POST(request: Request) {
  try {
    const body: PropertyRequest = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ error: 'No address provided' }, { status: 400 });
    }

    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'Property API not configured',
        message: 'Add RAPIDAPI_KEY to environment variables'
      }, { status: 500 });
    }

    // Step 1: Use autocomplete to find property ID
    const encodedAddress = encodeURIComponent(address);
    const autocompleteUrl = `https://realty-in-us.p.rapidapi.com/locations/v2/auto-complete?input=${encodedAddress}`;

    const autocompleteResponse = await fetch(autocompleteUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com',
      },
    });

    if (!autocompleteResponse.ok) {
      console.error('Autocomplete API error:', autocompleteResponse.status);
      return NextResponse.json({
        error: 'Failed to search for property',
        message: `API returned status ${autocompleteResponse.status}`
      }, { status: autocompleteResponse.status });
    }

    const autocompleteData = await autocompleteResponse.json();

    // Find address match in autocomplete results
    const addressResult = autocompleteData.autocomplete?.find(
      (item: { area_type: string; mpr_id?: string }) =>
        item.area_type === 'address' && item.mpr_id
    );

    if (!addressResult) {
      // Try to get info from street/city if no exact address match
      const streetResult = autocompleteData.autocomplete?.find(
        (item: { area_type: string }) => item.area_type === 'street'
      );

      return NextResponse.json({
        error: 'Property not found',
        message: 'No exact property match found. Try entering a more specific address.',
        suggestion: streetResult ? `Did you mean: ${streetResult.street}, ${streetResult.city}, ${streetResult.state_code}?` : null
      }, { status: 404 });
    }

    const propertyId = addressResult.mpr_id;

    // Step 2: Get property details
    const detailUrl = `https://realty-in-us.p.rapidapi.com/properties/v2/detail?property_id=${propertyId}`;

    const detailResponse = await fetch(detailUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com',
      },
    });

    // Handle 204 No Content (property exists but no detailed data)
    if (detailResponse.status === 204) {
      // Return basic info from autocomplete
      const propertyData: PropertyData = {
        address: addressResult.full_address?.[0] || addressResult.line || address,
        city: addressResult.city || 'N/A',
        state: addressResult.state_code || 'N/A',
        zipCode: addressResult.postal_code || 'N/A',
        county: 'N/A',
        lotSize: 'N/A',
        lotSizeAcres: 'N/A',
        zoning: 'N/A',
        landUse: 'N/A',
        yearBuilt: 'N/A',
        squareFootage: 'N/A',
        bedrooms: 'N/A',
        bathrooms: 'N/A',
        assessedValue: 'N/A',
        taxAmount: 'N/A',
        lastSaleDate: 'N/A',
        lastSalePrice: 'N/A',
        ownerName: 'N/A',
        ownerType: 'N/A',
        propertyType: 'N/A',
        stories: 'N/A',
        garage: 'N/A',
        listPrice: 'N/A',
        status: addressResult.prop_status?.join(', ') || 'N/A',
      };

      return NextResponse.json({
        ...propertyData,
        limitedData: true,
        message: 'Limited data available for this property'
      });
    }

    if (!detailResponse.ok) {
      console.error('Detail API error:', detailResponse.status);
      return NextResponse.json({
        error: 'Failed to fetch property details',
        message: `API returned status ${detailResponse.status}`
      }, { status: detailResponse.status });
    }

    const detailData = await detailResponse.json();
    const property = detailData.properties?.[0] || detailData;

    // Format the response
    const propertyData: PropertyData = {
      address: property.address?.line || addressResult.full_address?.[0] || address,
      city: property.address?.city || addressResult.city || 'N/A',
      state: property.address?.state_code || addressResult.state_code || 'N/A',
      zipCode: property.address?.postal_code || addressResult.postal_code || 'N/A',
      county: property.address?.county || 'N/A',

      lotSize: property.lot_sqft ? `${property.lot_sqft.toLocaleString()} sq ft` : 'N/A',
      lotSizeAcres: property.lot_sqft ? `${(property.lot_sqft / 43560).toFixed(2)} acres` : 'N/A',
      zoning: property.zoning || 'N/A',
      landUse: property.prop_type || property.type || 'N/A',

      yearBuilt: property.year_built?.toString() || 'N/A',
      squareFootage: property.sqft ? `${property.sqft.toLocaleString()} sq ft` : 'N/A',
      bedrooms: property.beds?.toString() || 'N/A',
      bathrooms: property.baths?.toString() || property.baths_full?.toString() || 'N/A',

      assessedValue: property.assessments?.[0]?.value
        ? `$${property.assessments[0].value.toLocaleString()}`
        : 'N/A',
      taxAmount: property.tax_history?.[0]?.tax
        ? `$${property.tax_history[0].tax.toLocaleString()}/yr`
        : 'N/A',
      lastSaleDate: property.sold_history?.[0]?.date
        ? new Date(property.sold_history[0].date).toLocaleDateString()
        : 'N/A',
      lastSalePrice: property.sold_history?.[0]?.price
        ? `$${property.sold_history[0].price.toLocaleString()}`
        : property.price ? `$${property.price.toLocaleString()}` : 'N/A',

      ownerName: property.owner?.name || 'N/A',
      ownerType: property.flags?.is_owner_occupied ? 'Owner Occupied' : 'N/A',

      propertyType: property.prop_type || property.type || 'N/A',
      stories: property.stories?.toString() || 'N/A',
      garage: property.garage ? `${property.garage} car` : 'N/A',
      listPrice: property.list_price ? `$${property.list_price.toLocaleString()}` : 'N/A',
      status: property.status || addressResult.prop_status?.join(', ') || 'N/A',
    };

    return NextResponse.json(propertyData);
  } catch (error) {
    console.error('Property API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch property data',
      message: String(error)
    }, { status: 500 });
  }
}
