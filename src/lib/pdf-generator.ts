import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generateInvoicePDF(elementId: string, filename: string) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found');
        return;
    }

    try {
        // High quality capture
        const canvas = await html2canvas(element, {
            scale: 3, // Higher scale for better PDF quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png', 1.0);

        // A4 Paper proportions
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Calculate dimensions to fit ONE page with a small safety margin
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;

        // Use 98% of page size as a safety margin to prevent second-page bleed
        const margin = 2.0;
        const maxWidth = pdfWidth - (margin * 2);
        const maxHeight = pdfHeight - (margin * 2);

        let width = maxWidth;
        let height = maxWidth / ratio;

        if (height > maxHeight) {
            height = maxHeight;
            width = maxHeight * ratio;
        }

        // Center horizontally and vertically within safety margins
        const x = (pdfWidth - width) / 2;
        const y = margin;

        pdf.addImage(imgData, 'PNG', x, y, width, height, undefined, 'FAST');
        pdf.save(filename);

    } catch (error) {
        console.error('PDF Generation Error:', error);
    }
}
