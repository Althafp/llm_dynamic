import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

interface LocationMapping {
  ip: string;
  latitude: number;
  longitude: number;
  locationName: string;
  mandal: string;
  district: string;
  cameraType: string;
}

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'guntur.xlsx');
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Map the data to our interface
    const mapping: Record<string, LocationMapping> = {};
    
    data.forEach((row: any) => {
      const ip = row['CAMERA IP'] || row['CAMERA_IP'];
      if (ip) {
        mapping[ip] = {
          ip: ip,
          latitude: parseFloat(row['LATITUDE']) || 0,
          longitude: parseFloat(row['LONGITUDE']) || 0,
          locationName: row['Location Name'] || row['Location_Name'] || '',
          mandal: row['MANDAL'] || '',
          district: row['NEW DISTRICT'] || row['NEW_DISTRICT'] || row['Old DISTRICT'] || row['Old_DISTRICT'] || '',
          cameraType: row['TYPE OF CAMERA'] || row['TYPE_OF_CAMERA'] || '',
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      mapping,
    });
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read location mapping file',
      },
      { status: 500 }
    );
  }
}

