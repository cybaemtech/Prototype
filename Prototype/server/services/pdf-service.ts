import mammoth from "mammoth";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import { type Document } from "@shared/schema";

export interface ControlCopyInfo {
  userId: string;
  userFullName: string;
  controlCopyNumber: number;
  date: string;
}

export class PDFService {
  private uploadsDir = path.join(process.cwd(), "uploads");
  private pdfsDir = path.join(process.cwd(), "pdfs");

  constructor() {
    // Directories will be initialized via initialize() method
  }

  async initialize(): Promise<void> {
    await this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.pdfsDir, { recursive: true });
  }

  async convertWordToPDF(
    wordFilePath: string,
    document: Document,
    controlCopyInfo?: ControlCopyInfo
  ): Promise<string> {
    const wordBuffer = await fs.readFile(wordFilePath);
    const result = await mammoth.convertToHtml({ buffer: wordBuffer });
    const htmlContent = result.value;

    const fullHtml = this.buildFullHtml(document, htmlContent, controlCopyInfo);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      const pdfFileName = controlCopyInfo 
        ? `${document.docNumber}_v${document.revisionNo}_cc${controlCopyInfo.controlCopyNumber}.pdf`
        : `${document.docNumber}_v${document.revisionNo}.pdf`;
      
      const pdfPath = path.join(this.pdfsDir, pdfFileName);

      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '80px',
          bottom: '100px',
          left: '40px',
          right: '40px'
        }
      });

      return pdfPath;
    } finally {
      await browser.close();
    }
  }

  private buildFullHtml(
    document: Document,
    bodyContent: string,
    controlCopyInfo?: ControlCopyInfo
  ): string {
    const headerHtml = this.buildHeader(document);
    const footerHtml = this.buildFooter(document, controlCopyInfo);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0;
    }
    body {
      margin: 0;
      padding: 80px 40px 100px 40px;
      font-family: Arial, sans-serif;
      font-size: 12pt;
    }
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      background: #f8f9fa;
      border-bottom: 2px solid #007bff;
      padding: 10px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 100px;
      background: #f8f9fa;
      border-top: 2px solid #007bff;
      padding: 10px 40px;
      font-size: 10pt;
    }
    .control-copy-watermark {
      background: #fff3cd;
      border: 2px dashed #ffc107;
      padding: 8px;
      margin-top: 5px;
      font-weight: bold;
      color: #856404;
      text-align: center;
    }
    .header-info, .footer-info {
      font-size: 10pt;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: bold;
      color: #007bff;
    }
    .content {
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="header">
    ${headerHtml}
  </div>
  
  <div class="content">
    ${bodyContent}
  </div>
  
  <div class="footer">
    ${footerHtml}
  </div>
</body>
</html>
    `;
  }

  private buildHeader(document: Document): string {
    return `
      <div>
        <div class="doc-title">${document.docName}</div>
        <div class="header-info">
          <strong>Doc No:</strong> ${document.docNumber} | 
          <strong>Rev:</strong> ${document.revisionNo} | 
          <strong>Date:</strong> ${new Date(document.dateOfIssue || new Date()).toLocaleDateString()}
        </div>
        ${document.headerInfo ? `<div class="header-info">${this.escapeHtml(document.headerInfo)}</div>` : ''}
      </div>
    `;
  }

  private buildFooter(document: Document, controlCopyInfo?: ControlCopyInfo): string {
    let footerContent = `
      <div class="footer-info">
        ${document.footerInfo ? `<div>${this.escapeHtml(document.footerInfo)}</div>` : ''}
      </div>
    `;

    if (controlCopyInfo) {
      footerContent += `
        <div class="control-copy-watermark">
          CONTROLLED COPY - NOT FOR DISTRIBUTION<br/>
          User ID: ${controlCopyInfo.userId} | 
          Control Copy No: ${controlCopyInfo.controlCopyNumber} | 
          Date: ${controlCopyInfo.date}
        </div>
      `;
    }

    return footerContent;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async saveUploadedFile(fileBuffer: Buffer, originalName: string, documentId: string): Promise<string> {
    await this.ensureDirectories();
    const fileName = `${documentId}_${Date.now()}_${originalName}`;
    const filePath = path.join(this.uploadsDir, fileName);
    await fs.writeFile(filePath, fileBuffer);
    return filePath;
  }

  async getDocumentVersions(docNumber: string): Promise<string[]> {
    const files = await fs.readdir(this.pdfsDir);
    return files.filter(f => f.startsWith(docNumber));
  }

  async extractHeaderFooterFromWord(fileBuffer: Buffer): Promise<{ headerInfo: string, footerInfo: string }> {
    try {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      const htmlContent = result.value;
      
      const lines = htmlContent.split('</p>').map(line => {
        const text = line.replace(/<[^>]*>/g, '').trim();
        return text;
      }).filter(line => line.length > 0);
      
      let headerInfo = '';
      let footerInfo = '';
      
      if (lines.length > 0) {
        headerInfo = lines.slice(0, Math.min(2, lines.length)).join(' ');
      }
      
      if (lines.length > 2) {
        footerInfo = lines.slice(-2).join(' ');
      } else {
        footerInfo = 'Standard Footer';
      }
      
      return {
        headerInfo: headerInfo || 'Document Header',
        footerInfo: footerInfo || 'Document Footer'
      };
    } catch (error) {
      console.error('Error extracting header/footer:', error);
      return {
        headerInfo: 'Document Header',
        footerInfo: 'Document Footer'
      };
    }
  }
}

export const pdfService = new PDFService();
