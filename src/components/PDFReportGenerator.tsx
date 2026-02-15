'use client';

import { useState } from 'react';
import { PropertyData } from '@/types';
import { SelectedParcel } from '@/components/MapView';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportGeneratorProps {
  propertyData: PropertyData;
  address: string;
  selectedParcel?: SelectedParcel | null;
  accessPoints?: Array<{ roadName: string; vpd?: number; vpdSource?: string }>;
}

export default function PDFReportGenerator({
  propertyData,
  address,
  selectedParcel,
  accessPoints = []
}: PDFReportGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const generateReport = async () => {
    if (!propertyData.analysis) {
      alert('Please run an analysis first');
      return;
    }

    setGenerating(true);
    setProgress(5);
    setCurrentStep('Initializing report...');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Colors
      const primaryColor: [number, number, number] = [0, 180, 180]; // Cyan
      const accentGreen: [number, number, number] = [34, 197, 94];
      const accentYellow: [number, number, number] = [234, 179, 8];
      const accentRed: [number, number, number] = [239, 68, 68];
      const darkBg: [number, number, number] = [17, 24, 39];
      const cardBg: [number, number, number] = [31, 41, 55];
      const textWhite: [number, number, number] = [255, 255, 255];
      const textMuted: [number, number, number] = [156, 163, 175];

      // Helper: check if new page needed
      const checkNewPage = (requiredSpace: number = 30) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Helper: draw score bar
      const drawScoreBar = (x: number, y: number, width: number, score: number, maxScore: number = 10) => {
        const barHeight = 4;
        const fillWidth = (score / maxScore) * width;
        const color = score >= 7 ? accentGreen : score >= 4 ? accentYellow : accentRed;

        doc.setFillColor(50, 50, 60);
        doc.roundedRect(x, y, width, barHeight, 1, 1, 'F');
        doc.setFillColor(...color);
        doc.roundedRect(x, y, fillWidth, barHeight, 1, 1, 'F');
      };

      // Helper: section header
      const addSectionHeader = (title: string, icon?: string) => {
        checkNewPage(25);
        doc.setFillColor(...cardBg);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), margin + 5, yPos + 7);
        yPos += 15;
      };

      setProgress(10);
      setCurrentStep('Creating cover page...');

      // ========== COVER PAGE ==========
      // Background
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Logo area
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 8, 'F');

      // Title
      doc.setTextColor(...textWhite);
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text('DRONE SENSE', pageWidth / 2, 50, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(...textMuted);
      doc.text('Commercial Site Analysis Report', pageWidth / 2, 62, { align: 'center' });

      // Property address box
      doc.setFillColor(...cardBg);
      doc.roundedRect(margin, 85, pageWidth - 2 * margin, 35, 3, 3, 'F');

      doc.setTextColor(...textMuted);
      doc.setFontSize(10);
      doc.text('SUBJECT PROPERTY', margin + 5, 95);

      doc.setTextColor(...textWhite);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const addressLines = doc.splitTextToSize(address || 'Address Not Specified', pageWidth - 2 * margin - 10);
      doc.text(addressLines, margin + 5, 105);

      if (propertyData.coordinates) {
        doc.setFontSize(10);
        doc.setTextColor(...textMuted);
        doc.text(
          `Coordinates: ${propertyData.coordinates.lat.toFixed(6)}, ${propertyData.coordinates.lng.toFixed(6)}`,
          margin + 5,
          115
        );
      }

      // Feasibility Score - Big Display
      const { analysis } = propertyData;
      const score = analysis?.viabilityScore || 0;
      const scoreLabel = getScoreLabel(score);
      const scoreColor = getScoreColor(score);

      doc.setFillColor(...cardBg);
      doc.roundedRect(margin, 135, pageWidth - 2 * margin, 55, 3, 3, 'F');

      doc.setTextColor(...textMuted);
      doc.setFontSize(10);
      doc.text('OVERALL FEASIBILITY SCORE', pageWidth / 2, 148, { align: 'center' });

      // Large score circle
      doc.setFillColor(...scoreColor);
      doc.circle(pageWidth / 2, 170, 18, 'F');
      doc.setTextColor(...textWhite);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(score.toFixed(1), pageWidth / 2, 175, { align: 'center' });

      doc.setFontSize(12);
      doc.text(scoreLabel, pageWidth / 2, 195, { align: 'center' });

      // Report metadata
      doc.setFillColor(...cardBg);
      doc.roundedRect(margin, 205, pageWidth - 2 * margin, 25, 3, 3, 'F');

      doc.setFontSize(9);
      doc.setTextColor(...textMuted);
      doc.text('Report Generated:', margin + 5, 215);
      doc.setTextColor(...textWhite);
      doc.text(new Date().toLocaleString(), margin + 40, 215);

      doc.setTextColor(...textMuted);
      doc.text('Analysis Type:', margin + 5, 223);
      doc.setTextColor(...textWhite);
      doc.text('Comprehensive Site Analysis', margin + 35, 223);

      // Footer disclaimer
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      const disclaimer = 'This report is for informational purposes only. All data should be verified through official sources before making investment decisions.';
      const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin);
      doc.text(disclaimerLines, pageWidth / 2, pageHeight - 25, { align: 'center' });

      doc.setTextColor(...primaryColor);
      doc.text('www.dronesense.ai', pageWidth / 2, pageHeight - 15, { align: 'center' });

      setProgress(20);
      setCurrentStep('Adding executive summary...');

      // ========== PAGE 2: EXECUTIVE SUMMARY ==========
      doc.addPage();
      yPos = margin;

      // Page header
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DRONE SENSE | Site Analysis Report', margin, 8);
      doc.setTextColor(...textMuted);
      doc.text(address.substring(0, 50) + (address.length > 50 ? '...' : ''), pageWidth - margin, 8, { align: 'right' });

      yPos = 20;

      addSectionHeader('Executive Summary');

      // Score breakdown
      doc.setFillColor(...cardBg);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 50, 3, 3, 'F');

      if (analysis?.feasibilityScore?.breakdown) {
        const breakdown = analysis.feasibilityScore.breakdown;
        const barWidth = 60;
        const startX = margin + 60;

        const scores = [
          { label: 'Traffic & Visibility', value: breakdown.trafficScore },
          { label: 'Demographics', value: breakdown.demographicsScore },
          { label: 'Competition Analysis', value: breakdown.competitionScore },
          { label: 'Site Access', value: breakdown.accessScore },
        ];

        scores.forEach((item, idx) => {
          const itemY = yPos + 10 + idx * 10;
          doc.setFontSize(9);
          doc.setTextColor(...textWhite);
          doc.text(item.label + ':', margin + 5, itemY + 3);
          drawScoreBar(startX, itemY, barWidth, item.value);
          doc.setTextColor(...textMuted);
          doc.text(`${item.value.toFixed(1)}/10`, startX + barWidth + 5, itemY + 3);
        });
      }

      yPos += 60;

      // Key findings
      if (analysis?.keyFindings && analysis.keyFindings.length > 0) {
        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Findings', margin, yPos);
        yPos += 6;

        doc.setTextColor(...textWhite);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        analysis.keyFindings.slice(0, 5).forEach((finding, idx) => {
          checkNewPage(12);
          doc.setTextColor(...accentGreen);
          doc.text('•', margin + 3, yPos);
          doc.setTextColor(...textWhite);
          const lines = doc.splitTextToSize(finding, pageWidth - 2 * margin - 10);
          doc.text(lines, margin + 8, yPos);
          yPos += lines.length * 4 + 3;
        });
      }

      yPos += 5;

      // Business recommendation
      if (analysis?.businessRecommendation) {
        doc.setFillColor(0, 100, 100, 0.3);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 2, 2, 'F');
        doc.setDrawColor(...primaryColor);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 2, 2, 'S');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('AI RECOMMENDATION', margin + 5, yPos + 6);

        doc.setTextColor(...textWhite);
        doc.setFont('helvetica', 'normal');
        const recLines = doc.splitTextToSize(analysis.businessRecommendation, pageWidth - 2 * margin - 10);
        doc.text(recLines.slice(0, 3), margin + 5, yPos + 13);
        yPos += 30;
      }

      setProgress(35);
      setCurrentStep('Adding property details...');

      // ========== PROPERTY DETAILS ==========
      addSectionHeader('Property Details');

      const parcelInfo = selectedParcel?.parcelInfo;
      const propertyDetails: [string, string][] = [];

      if (parcelInfo?.apn) propertyDetails.push(['Parcel Number (APN)', parcelInfo.apn]);
      if (parcelInfo?.owner) propertyDetails.push(['Owner', parcelInfo.owner]);
      if (parcelInfo?.acres) propertyDetails.push(['Lot Size', `${parcelInfo.acres.toFixed(2)} acres (${(parcelInfo.acres * 43560).toLocaleString()} sq ft)`]);
      if (parcelInfo?.zoning) propertyDetails.push(['Zoning', parcelInfo.zoning]);
      if (parcelInfo?.landUse) propertyDetails.push(['Land Use', parcelInfo.landUse]);
      if (analysis?.terrain) propertyDetails.push(['Terrain', analysis.terrain]);
      if (analysis?.accessibility) propertyDetails.push(['Accessibility', analysis.accessibility]);

      if (propertyDetails.length > 0) {
        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Property Characteristic', 'Value']],
          body: propertyDetails,
          styles: {
            fillColor: cardBg,
            textColor: textWhite,
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: [0, 120, 120],
            textColor: textWhite,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [40, 50, 65],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(45);
      setCurrentStep('Adding traffic analysis...');

      // ========== TRAFFIC ANALYSIS ==========
      addSectionHeader('Traffic Analysis');

      if (propertyData.trafficData) {
        const traffic = propertyData.trafficData;

        // VPD highlight box
        doc.setFillColor(...cardBg);
        doc.roundedRect(margin, yPos, 70, 30, 3, 3, 'F');
        doc.setTextColor(...textMuted);
        doc.setFontSize(8);
        doc.text('ESTIMATED DAILY TRAFFIC', margin + 5, yPos + 8);
        doc.setTextColor(...accentGreen);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text((traffic.estimatedVPD?.toLocaleString() || 'N/A'), margin + 5, yPos + 22);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('VPD', margin + 50, yPos + 22);

        // Traffic details
        doc.setFillColor(...cardBg);
        doc.roundedRect(margin + 75, yPos, pageWidth - 2 * margin - 75, 30, 3, 3, 'F');

        doc.setFontSize(9);
        doc.setTextColor(...textMuted);
        doc.text('Road Type:', margin + 80, yPos + 10);
        doc.setTextColor(...textWhite);
        doc.text(traffic.roadType || 'N/A', margin + 105, yPos + 10);

        doc.setTextColor(...textMuted);
        doc.text('Traffic Level:', margin + 80, yPos + 18);
        doc.setTextColor(...textWhite);
        doc.text(traffic.trafficLevel || 'N/A', margin + 110, yPos + 18);

        doc.setTextColor(...textMuted);
        doc.text('VPD Range:', margin + 80, yPos + 26);
        doc.setTextColor(...textWhite);
        doc.text(traffic.vpdRange || 'N/A', margin + 105, yPos + 26);

        yPos += 38;

        // Access points
        if (accessPoints && accessPoints.length > 0) {
          doc.setTextColor(...primaryColor);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Road Access Points', margin, yPos);
          yPos += 5;

          autoTable(doc, {
            startY: yPos,
            margin: { left: margin, right: margin },
            head: [['Road Name', 'Traffic (VPD)', 'Data Source']],
            body: accessPoints.slice(0, 6).map(ap => [
              ap.roadName,
              ap.vpd?.toLocaleString() || 'N/A',
              ap.vpdSource === 'fdot' ? 'FDOT Official' : 'Estimated',
            ]),
            styles: {
              fillColor: cardBg,
              textColor: textWhite,
              fontSize: 9,
            },
            headStyles: {
              fillColor: [0, 120, 120],
              textColor: textWhite,
              fontStyle: 'bold',
            },
            alternateRowStyles: {
              fillColor: [40, 50, 65],
            },
          });
          yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        }
      }

      setProgress(55);
      setCurrentStep('Adding demographics...');

      // ========== DEMOGRAPHICS ==========
      checkNewPage(60);
      addSectionHeader('Demographics Analysis');

      if (propertyData.demographicsData) {
        const demo = propertyData.demographicsData;

        // Key metrics row
        const metricWidth = (pageWidth - 2 * margin - 10) / 3;

        const metrics = [
          { label: 'Population', value: demo.population?.toLocaleString() || 'N/A', sub: '1-mile radius' },
          { label: 'Median Income', value: `$${demo.medianHouseholdIncome?.toLocaleString() || 'N/A'}`, sub: 'Household' },
          { label: 'Market Type', value: demo.isCollegeTown ? 'College Town' : 'Standard', sub: demo.isCollegeTown ? 'Student population present' : '' },
        ];

        metrics.forEach((m, idx) => {
          const x = margin + idx * (metricWidth + 5);
          doc.setFillColor(...cardBg);
          doc.roundedRect(x, yPos, metricWidth, 28, 2, 2, 'F');

          doc.setTextColor(...textMuted);
          doc.setFontSize(8);
          doc.text(m.label.toUpperCase(), x + 5, yPos + 8);

          doc.setTextColor(...textWhite);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(m.value, x + 5, yPos + 18);

          if (m.sub) {
            doc.setTextColor(...textMuted);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(m.sub, x + 5, yPos + 24);
          }
        });

        yPos += 35;

        // Multi-radius population
        if (demo.multiRadius) {
          doc.setTextColor(...primaryColor);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Population by Radius', margin, yPos);
          yPos += 5;

          autoTable(doc, {
            startY: yPos,
            margin: { left: margin, right: margin },
            head: [['Radius', 'Population', 'Households', 'Density']],
            body: [
              ['1 Mile', demo.multiRadius.oneMile?.population?.toLocaleString() || 'N/A',
               demo.multiRadius.oneMile?.households?.toLocaleString() || 'N/A',
               demo.multiRadius.oneMile ? `${Math.round(demo.multiRadius.oneMile.population / 3.14).toLocaleString()}/sq mi` : '-'],
              ['3 Miles', demo.multiRadius.threeMile?.population?.toLocaleString() || 'N/A',
               demo.multiRadius.threeMile?.households?.toLocaleString() || 'N/A',
               demo.multiRadius.threeMile ? `${Math.round(demo.multiRadius.threeMile.population / 28.27).toLocaleString()}/sq mi` : '-'],
              ['5 Miles', demo.multiRadius.fiveMile?.population?.toLocaleString() || 'N/A',
               demo.multiRadius.fiveMile?.households?.toLocaleString() || 'N/A',
               demo.multiRadius.fiveMile ? `${Math.round(demo.multiRadius.fiveMile.population / 78.54).toLocaleString()}/sq mi` : '-'],
            ],
            styles: {
              fillColor: cardBg,
              textColor: textWhite,
              fontSize: 9,
            },
            headStyles: {
              fillColor: [0, 120, 120],
              textColor: textWhite,
              fontStyle: 'bold',
            },
            alternateRowStyles: {
              fillColor: [40, 50, 65],
            },
          });
          yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        }
      }

      setProgress(65);
      setCurrentStep('Adding market analysis...');

      // ========== MARKET ANALYSIS ==========
      checkNewPage(60);
      addSectionHeader('Competitive Landscape');

      if (propertyData.businesses && propertyData.businesses.length > 0) {
        // Business count by category
        const typeCount = propertyData.businesses.reduce((acc, b) => {
          acc[b.type] = (acc[b.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const sortedTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

        doc.setFillColor(...cardBg);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 2, 2, 'F');

        doc.setTextColor(...textMuted);
        doc.setFontSize(8);
        doc.text('TOTAL NEARBY BUSINESSES', margin + 5, yPos + 8);
        doc.setTextColor(...accentGreen);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(propertyData.businesses.length.toString(), margin + 5, yPos + 22);

        // Category breakdown
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let catX = margin + 50;
        sortedTypes.forEach(([type, count], idx) => {
          if (idx < 3) {
            doc.setTextColor(...textMuted);
            doc.text(type + ':', catX, yPos + 10 + idx * 8);
            doc.setTextColor(...textWhite);
            doc.text(count.toString(), catX + 40, yPos + 10 + idx * 8);
          } else if (idx < 6) {
            doc.setTextColor(...textMuted);
            doc.text(type + ':', catX + 70, yPos + 10 + (idx - 3) * 8);
            doc.setTextColor(...textWhite);
            doc.text(count.toString(), catX + 110, yPos + 10 + (idx - 3) * 8);
          }
        });

        yPos += 42;

        // Nearest competitors
        doc.setTextColor(...primaryColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Nearest Competitors', margin, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Business Name', 'Category', 'Distance']],
          body: propertyData.businesses.slice(0, 8).map(b => [b.name, b.type, b.distance]),
          styles: {
            fillColor: cardBg,
            textColor: textWhite,
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 120, 120],
            textColor: textWhite,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [40, 50, 65],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(75);
      setCurrentStep('Adding environmental assessment...');

      // ========== ENVIRONMENTAL RISK ==========
      checkNewPage(60);
      addSectionHeader('Environmental Risk Assessment');

      if (propertyData.environmentalRisk) {
        const env = propertyData.environmentalRisk;
        const riskScore = env.overallRiskScore;
        const riskColor = riskScore >= 70 ? accentGreen : riskScore >= 40 ? accentYellow : accentRed;
        const riskLabel = riskScore >= 70 ? 'Low Risk' : riskScore >= 40 ? 'Moderate Risk' : 'High Risk';

        // Risk score box
        doc.setFillColor(...cardBg);
        doc.roundedRect(margin, yPos, 50, 28, 2, 2, 'F');
        doc.setTextColor(...textMuted);
        doc.setFontSize(8);
        doc.text('RISK SCORE', margin + 5, yPos + 8);
        doc.setTextColor(...riskColor);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(`${riskScore}`, margin + 5, yPos + 20);
        doc.setFontSize(10);
        doc.text('/100', margin + 25, yPos + 20);
        doc.setFontSize(8);
        doc.text(riskLabel, margin + 5, yPos + 26);

        yPos += 35;

        // Risk categories
        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Risk Category', 'Status', 'Details']],
          body: [
            ['Flood Zone', `${env.floodZone.zone} (${env.floodZone.risk.toUpperCase()})`, env.floodZone.description],
            ['Wetlands', env.wetlands.present ? 'PRESENT' : 'None', env.wetlands.present ? 'Within 500m of property' : 'No wetlands detected'],
            ['Brownfields', env.brownfields.present ? `${env.brownfields.count} site(s)` : 'None', env.brownfields.present ? 'Within 1 mile' : 'No contaminated sites'],
            ['Superfund Sites', env.superfund.present ? `${env.superfund.count} site(s)` : 'None', env.superfund.present ? 'Requires review' : 'No superfund sites nearby'],
          ],
          styles: {
            fillColor: cardBg,
            textColor: textWhite,
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 120, 120],
            textColor: textWhite,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [40, 50, 65],
          },
          columnStyles: {
            2: { cellWidth: 60 },
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // Risk factors
        if (env.riskFactors && env.riskFactors.length > 0) {
          doc.setFillColor(100, 50, 50);
          doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 5 + env.riskFactors.length * 5, 2, 2, 'F');
          doc.setTextColor(255, 200, 200);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Risk Factors Identified:', margin + 5, yPos + 5);
          doc.setFont('helvetica', 'normal');
          env.riskFactors.forEach((factor, idx) => {
            doc.text(`• ${factor}`, margin + 5, yPos + 10 + idx * 5);
          });
          yPos += 10 + env.riskFactors.length * 5;
        }
      }

      setProgress(85);
      setCurrentStep('Adding retailer matches...');

      // ========== RETAILER MATCHES ==========
      if (analysis?.retailerMatches?.matches && analysis.retailerMatches.matches.length > 0) {
        checkNewPage(60);
        addSectionHeader('Recommended Retailers');

        doc.setTextColor(...textMuted);
        doc.setFontSize(9);
        doc.text(`Based on site characteristics, ${analysis.retailerMatches.totalMatches} potential retailer matches were identified.`, margin, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Retailer', 'Category', 'Match', 'Est. Investment', 'Status']],
          body: analysis.retailerMatches.matches.slice(0, 10).map(r => [
            r.name,
            r.category,
            `${r.matchScore}%`,
            r.totalInvestment || 'N/A',
            r.activelyExpanding ? 'Expanding' : 'Standard',
          ]),
          styles: {
            fillColor: cardBg,
            textColor: textWhite,
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 120, 120],
            textColor: textWhite,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [40, 50, 65],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(92);
      setCurrentStep('Adding recommendations...');

      // ========== RECOMMENDATIONS ==========
      checkNewPage(50);
      addSectionHeader('Recommendations & Next Steps');

      if (analysis?.recommendations && analysis.recommendations.length > 0) {
        analysis.recommendations.forEach((rec, idx) => {
          checkNewPage(15);
          doc.setFillColor(...cardBg);
          doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, 'F');

          doc.setFillColor(...primaryColor);
          doc.circle(margin + 8, yPos + 6, 4, 'F');
          doc.setTextColor(...textWhite);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text((idx + 1).toString(), margin + 8, yPos + 7, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          const recLines = doc.splitTextToSize(rec, pageWidth - 2 * margin - 25);
          doc.text(recLines[0], margin + 16, yPos + 7);
          yPos += 15;
        });
      }

      setProgress(98);
      setCurrentStep('Adding page numbers...');

      // ========== FOOTER ON ALL PAGES ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...darkBg);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        doc.setDrawColor(...primaryColor);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setTextColor(...textMuted);
        doc.setFontSize(7);
        doc.text('Confidential - For authorized use only', margin, pageHeight - 5);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
        doc.setTextColor(...primaryColor);
        doc.text('DRONE SENSE', pageWidth / 2, pageHeight - 5, { align: 'center' });
      }

      setProgress(100);
      setCurrentStep('Complete!');

      // Save PDF
      const fileName = `DroneSense-Report-${address.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        setCurrentStep('');
      }, 1000);

    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Failed to generate report. Please try again.');
      setGenerating(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'EXCELLENT';
    if (score >= 6) return 'GOOD';
    if (score >= 4) return 'FAIR';
    return 'NEEDS REVIEW';
  };

  const getScoreColor = (score: number): [number, number, number] => {
    if (score >= 8) return [34, 197, 94];
    if (score >= 6) return [6, 182, 212];
    if (score >= 4) return [234, 179, 8];
    return [239, 68, 68];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Professional PDF Report</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Download a comprehensive site analysis report
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating || !propertyData.analysis}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </>
          )}
        </button>
      </div>

      {generating && (
        <div className="space-y-2">
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-green)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center">
            {currentStep} ({progress}%)
          </p>
        </div>
      )}

      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Report Contents
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
          {[
            'Cover Page & Score',
            'Executive Summary',
            'Property Details',
            'Traffic Analysis',
            'Demographics Data',
            'Market Competition',
            'Environmental Risk',
            'Retailer Matches',
            'AI Recommendations',
            'Data Sources',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--accent-green)] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
