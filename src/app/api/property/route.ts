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

    // Use RealtyMole API via RapidAPI
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://realty-mole-property-api.p.rapidapi.com/properties?address=${encodedAddress}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'realty-mole-property-api.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RealtyMole API error:', response.status, errorText);

      if (response.status === 404) {
        return NextResponse.json({
          error: 'Property not found',
          message: 'No property data available for this address'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to fetch property data',
        message: errorText
      }, { status: response.status });
    }

    const data = await response.json();

    // Handle array response (API returns array of properties)
    const property = Array.isArray(data) ? data[0] : data;

    if (!property) {
      return NextResponse.json({
        error: 'Property not found',
        message: 'No property data available for this address'
      }, { status: 404 });
    }

    // Format the response
    const propertyData: PropertyData = {
      // Basic Info
      address: property.formattedAddress || property.addressLine1 || address,
      city: property.city || 'N/A',
      state: property.state || 'N/A',
      zipCode: property.zipCode || 'N/A',
      county: property.county || 'N/A',

      // Lot Info
      lotSize: property.lotSize ? `${property.lotSize.toLocaleString()} sq ft` : 'N/A',
      lotSizeAcres: property.lotSize ? `${(property.lotSize / 43560).toFixed(2)} acres` : 'N/A',
      zoning: property.zoning || 'N/A',
      landUse: property.propertyType || property.landUse || 'N/A',

      // Building Info
      yearBuilt: property.yearBuilt?.toString() || 'N/A',
      squareFootage: property.squareFootage ? `${property.squareFootage.toLocaleString()} sq ft` : 'N/A',
      bedrooms: property.bedrooms?.toString() || 'N/A',
      bathrooms: property.bathrooms?.toString() || 'N/A',

      // Value Info
      assessedValue: property.assessedValue
        ? `$${property.assessedValue.toLocaleString()}`
        : 'N/A',
      taxAmount: property.taxAssessment
        ? `$${property.taxAssessment.toLocaleString()}/yr`
        : 'N/A',
      lastSaleDate: property.lastSaleDate
        ? new Date(property.lastSaleDate).toLocaleDateString()
        : 'N/A',
      lastSalePrice: property.lastSalePrice
        ? `$${property.lastSalePrice.toLocaleString()}`
        : 'N/A',

      // Owner Info
      ownerName: property.owner || property.ownerNames?.join(', ') || 'N/A',
      ownerType: property.ownerOccupied ? 'Owner Occupied' : 'Non-Owner Occupied',
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
