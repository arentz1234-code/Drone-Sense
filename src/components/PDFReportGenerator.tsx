'use client';

import { useState, useRef } from 'react';
import { PropertyData } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportGeneratorProps {
  propertyData: PropertyData;
  address: string;
  mapRef?: React.RefObject<HTMLDivElement | null>;
}

export default function PDFReportGenerator({ propertyData, address, mapRef }: PDFReportGeneratorProps) {
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
    setCurrentStep('Initializing PDF...');

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

      // Helper function to add a new page if needed
      const checkNewPage = (requiredSpace: number = 20) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Colors
      const primaryColor: [number, number, number] = [0, 200, 150]; // Cyan-green
      const darkBg: [number, number, number] = [15, 15, 25];
      const textColor: [number, number, number] = [240, 240, 240];
      const mutedColor: [number, number, number] = [150, 150, 160];

      setProgress(10);
      setCurrentStep('Creating header...');

      // Header Section
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(...primaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('DRONE SENSE', margin, 20);

      doc.setFontSize(12);
      doc.setTextColor(...textColor);
      doc.text('Commercial Site Analysis Report', margin, 28);

      doc.setFontSize(9);
      doc.setTextColor(...mutedColor);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 20, { align: 'right' });

      yPos = 50;

      setProgress(20);
      setCurrentStep('Adding property details...');

      // Property Details Box
      doc.setFillColor(25, 25, 40);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, 'F');

      doc.setTextColor(...textColor);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Property Address:', margin + 5, yPos + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(address || 'Not specified', margin + 45, yPos + 8);

      if (propertyData.coordinates) {
        doc.setFont('helvetica', 'bold');
        doc.text('Coordinates:', margin + 5, yPos + 16);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${propertyData.coordinates.lat.toFixed(6)}, ${propertyData.coordinates.lng.toFixed(6)}`,
          margin + 35,
          yPos + 16
        );
      }

      yPos += 35;

      setProgress(30);
      setCurrentStep('Adding feasibility score...');

      // Feasibility Score Section
      const { analysis } = propertyData;
      const score = analysis?.viabilityScore || 0;
      const scoreLabel = getScoreLabel(score);
      const scoreColor = getScoreColor(score);

      doc.setFillColor(25, 25, 40);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, 'F');

      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FEASIBILITY SCORE', margin + 5, yPos + 10);

      // Score circle
      const circleX = margin + 25;
      const circleY = yPos + 30;
      doc.setFillColor(...scoreColor);
      doc.circle(circleX, circleY, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(score.toFixed(1), circleX, circleY + 2, { align: 'center' });

      doc.setTextColor(...textColor);
      doc.setFontSize(12);
      doc.text(scoreLabel, circleX + 20, circleY + 2);

      // Breakdown scores
      if (analysis?.feasibilityScore?.breakdown) {
        const breakdown = analysis.feasibilityScore.breakdown;
        const breakdownX = margin + 80;
        doc.setFontSize(9);
        doc.setTextColor(...mutedColor);

        const breakdownItems = [
          ['Traffic', breakdown.trafficScore],
          ['Demographics', breakdown.demographicsScore],
          ['Competition', breakdown.competitionScore],
          ['Access', breakdown.accessScore],
        ];

        breakdownItems.forEach((item, idx) => {
          const bx = breakdownX + (idx % 2) * 50;
          const by = yPos + 15 + Math.floor(idx / 2) * 12;
          doc.text(`${item[0]}: `, bx, by);
          doc.setTextColor(...getScoreColor(item[1] as number));
          doc.text(`${(item[1] as number).toFixed(1)}/10`, bx + 25, by);
          doc.setTextColor(...mutedColor);
        });
      }

      yPos += 55;

      setProgress(40);
      setCurrentStep('Adding traffic data...');

      // Traffic Analysis Table
      checkNewPage(50);
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TRAFFIC ANALYSIS', margin, yPos);
      yPos += 5;

      if (propertyData.trafficData) {
        const trafficData = propertyData.trafficData;
        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Metric', 'Value']],
          body: [
            ['Estimated VPD', `${trafficData.estimatedVPD?.toLocaleString() || 'N/A'} vehicles/day`],
            ['VPD Range', trafficData.vpdRange || 'N/A'],
            ['Road Type', trafficData.roadType || 'N/A'],
            ['Traffic Level', trafficData.trafficLevel || 'N/A'],
            ['Congestion', `${trafficData.congestionPercent || 0}%`],
          ],
          styles: {
            fillColor: [25, 25, 40],
            textColor: [240, 240, 240],
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 150, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [35, 35, 55],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      } else {
        doc.setTextColor(...mutedColor);
        doc.setFontSize(10);
        doc.text('Traffic data not available', margin, yPos + 8);
        yPos += 15;
      }

      setProgress(50);
      setCurrentStep('Adding demographics...');

      // Demographics Section
      checkNewPage(60);
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DEMOGRAPHICS ANALYSIS', margin, yPos);
      yPos += 5;

      if (propertyData.demographicsData) {
        const demo = propertyData.demographicsData;
        const demoBody: (string | number)[][] = [
          ['Population', demo.population?.toLocaleString() || 'N/A'],
          ['Median Household Income', `$${demo.medianHouseholdIncome?.toLocaleString() || 'N/A'}`],
          ['College Town', demo.isCollegeTown ? 'Yes' : 'No'],
        ];

        if (demo.multiRadius) {
          demoBody.push(
            ['Population (1 Mile)', demo.multiRadius.oneMile?.population?.toLocaleString() || 'N/A'],
            ['Population (3 Miles)', demo.multiRadius.threeMile?.population?.toLocaleString() || 'N/A'],
            ['Population (5 Miles)', demo.multiRadius.fiveMile?.population?.toLocaleString() || 'N/A']
          );
        }

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Metric', 'Value']],
          body: demoBody,
          styles: {
            fillColor: [25, 25, 40],
            textColor: [240, 240, 240],
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 150, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [35, 35, 55],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(60);
      setCurrentStep('Adding nearby businesses...');

      // Nearby Businesses
      checkNewPage(50);
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('NEARBY BUSINESSES', margin, yPos);
      yPos += 5;

      if (propertyData.businesses && propertyData.businesses.length > 0) {
        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Business Name', 'Type', 'Distance']],
          body: propertyData.businesses.slice(0, 10).map(b => [
            b.name,
            b.type,
            b.distance,
          ]),
          styles: {
            fillColor: [25, 25, 40],
            textColor: [240, 240, 240],
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 150, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [35, 35, 55],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(70);
      setCurrentStep('Adding environmental risk...');

      // Environmental Risk Assessment
      checkNewPage(60);
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ENVIRONMENTAL RISK ASSESSMENT', margin, yPos);
      yPos += 5;

      if (propertyData.environmentalRisk) {
        const env = propertyData.environmentalRisk;
        const riskScore = env.overallRiskScore;
        const riskLevel = riskScore >= 70 ? 'Low Risk' : riskScore >= 40 ? 'Moderate Risk' : 'High Risk';

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Category', 'Status', 'Details']],
          body: [
            ['Overall Risk Score', `${riskScore}/100 (${riskLevel})`, ''],
            ['Flood Zone', env.floodZone.zone, `${env.floodZone.risk} risk - ${env.floodZone.description}`],
            ['Wetlands', env.wetlands.present ? 'Present' : 'None', env.wetlands.present ? 'Within 500m' : 'No wetlands detected'],
            ['Brownfields', env.brownfields.present ? `${env.brownfields.count} site(s)` : 'None', env.brownfields.present ? 'Within 1 mile' : 'No brownfields detected'],
            ['Superfund Sites', env.superfund.present ? `${env.superfund.count} site(s)` : 'None', env.superfund.present ? 'Nearby' : 'No superfund sites detected'],
          ],
          styles: {
            fillColor: [25, 25, 40],
            textColor: [240, 240, 240],
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 150, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [35, 35, 55],
          },
          columnStyles: {
            2: { cellWidth: 60 },
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(80);
      setCurrentStep('Adding recommendations...');

      // AI Recommendations
      checkNewPage(50);
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('AI RECOMMENDATIONS', margin, yPos);
      yPos += 8;

      if (analysis?.businessRecommendation) {
        doc.setFillColor(25, 25, 40);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');
        doc.setTextColor(...textColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(analysis.businessRecommendation, pageWidth - 2 * margin - 10);
        doc.text(lines, margin + 5, yPos + 8);
        yPos += Math.max(20, lines.length * 5 + 10);
      }

      // Key Findings
      if (analysis?.keyFindings && analysis.keyFindings.length > 0) {
        checkNewPage(40);
        yPos += 5;
        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Findings:', margin, yPos);
        yPos += 6;

        doc.setTextColor(...textColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        analysis.keyFindings.forEach((finding, idx) => {
          checkNewPage(10);
          const findingLines = doc.splitTextToSize(`${idx + 1}. ${finding}`, pageWidth - 2 * margin - 5);
          doc.text(findingLines, margin + 3, yPos);
          yPos += findingLines.length * 4 + 2;
        });
      }

      // Recommendations List
      if (analysis?.recommendations && analysis.recommendations.length > 0) {
        checkNewPage(40);
        yPos += 5;
        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommendations:', margin, yPos);
        yPos += 6;

        doc.setTextColor(...textColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        analysis.recommendations.forEach((rec, idx) => {
          checkNewPage(10);
          const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 2 * margin - 5);
          doc.text(recLines, margin + 3, yPos);
          yPos += recLines.length * 4 + 2;
        });
      }

      setProgress(90);
      setCurrentStep('Adding retailer matches...');

      // Retailer Matches
      if (analysis?.retailerMatches?.matches && analysis.retailerMatches.matches.length > 0) {
        checkNewPage(50);
        doc.setTextColor(...primaryColor);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RETAILER MATCHES', margin, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Retailer', 'Category', 'Match Score', 'Investment']],
          body: analysis.retailerMatches.matches.slice(0, 8).map(r => [
            r.name,
            r.category,
            `${r.matchScore}%`,
            r.totalInvestment || 'N/A',
          ]),
          styles: {
            fillColor: [25, 25, 40],
            textColor: [240, 240, 240],
            fontSize: 9,
          },
          headStyles: {
            fillColor: [0, 150, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [35, 35, 55],
          },
        });
        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      setProgress(95);
      setCurrentStep('Finalizing document...');

      // Footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...darkBg);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        doc.text(
          'This report is for informational purposes only. Verify all data through official sources.',
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        doc.text('DRONE SENSE', margin, pageHeight - 8);
      }

      setProgress(100);
      setCurrentStep('Complete!');

      // Download the PDF
      doc.save(`drone-sense-report-${new Date().toISOString().split('T')[0]}.pdf`);

      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        setCurrentStep('');
      }, 1000);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Failed to generate report');
      setGenerating(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const getScoreColor = (score: number): [number, number, number] => {
    if (score >= 8) return [0, 200, 100];
    if (score >= 6) return [100, 200, 50];
    if (score >= 4) return [255, 180, 0];
    return [255, 80, 80];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Generate PDF Report</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Download a comprehensive analysis report
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
              Download PDF Report
            </>
          )}
        </button>
      </div>

      {generating && (
        <div className="space-y-2">
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center">
            {currentStep} ({progress}%)
          </p>
        </div>
      )}

      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-medium mb-2 text-sm">Report Includes:</h4>
        <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Executive Summary
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Traffic Analysis
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Demographics
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Nearby Businesses
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Risk Assessment
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Retailer Matches
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Recommendations
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Site Details
          </li>
        </ul>
      </div>
    </div>
  );
}
