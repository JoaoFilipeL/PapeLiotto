'use client'
import { Budget } from "../orders/types/orders";
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const getBudgetHtml = (budget: Budget): string => {
    const itemsHtml = budget.items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; vertical-align: top;">${item.product_name}</td>
            <td style="padding: 10px; vertical-align: top; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; vertical-align: top; text-align: right;">${item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="padding: 10px; vertical-align: top; text-align: right;">${(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>
    `).join('');

    return `
        <html>
        <head>
            <title>Orçamento ${budget.budget_code}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f8f8; }
                .page { width: 210mm; min-height: 297mm; padding: 20mm; margin: 10mm auto; background: white; box-shadow: 0 0 5px rgba(0, 0, 0, 0.1); box-sizing: border-box; display: flex; flex-direction: column; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 15px; }
                .header-left h1 { margin: 0; font-size: 28px; color: #333; }
                .header-left p { margin: 2px 0; font-size: 12px; color: #555; }
                .header-right { text-align: right; }
                .order-box { border: 2px solid #333; padding: 10px 15px; text-align: center; display: inline-block; }
                .order-box p { margin: 0; font-size: 12px; text-transform: uppercase; }
                .order-box h2 { margin: 5px 0 0 0; font-size: 24px; }
                .customer-details { border: 1px solid #ccc; padding: 20px; margin-top: 25px; border-radius: 8px; background-color: #fdfdfd; }
                .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px; }
                .customer-grid strong { color: #444; display: block; margin-bottom: 2px; }
                .customer-grid span { color: #666; }
                .items-section { flex-grow: 1; margin-top: 25px; }
                .items-section h2 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .items-table { width: 100%; border-collapse: collapse; }
                .items-table th { background-color: #f4f4f4; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #555; }
                .items-table tfoot td { padding: 10px; text-align: right; font-size: 14px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; display: flex; justify-content: space-between; align-items: flex-start; }
                .footer-left { font-size: 12px; color: #777; }
                .footer-left p { margin: 5px 0; }
                .footer-right { width: 45%; }
                .total-box { font-size: 22px; font-weight: bold; padding: 15px; background-color: #f4f4f4; border-radius: 8px; text-align: right; }
                .total-box span { display: block; font-size: 14px; font-weight: normal; color: #555; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="header-left">
                        <h1>Atitude Papelaria</h1>
                        <p>Rua Mato Grosso 1003</p><p>(43) 3323-7862</p><p>atitudeimportadora@gmail.com</p>
                    </div>
                    <div class="header-right"><div class="order-box"><p>Orçamento Nº</p><h2>${budget.budget_code}</h2></div></div>
                </div>
                <div class="customer-details">
                    <div class="customer-grid">
                        <div><strong>Cliente:</strong><span>${budget.customer_name || 'N/A'}</span></div>
                        <div><strong>Telefone:</strong><span>${(budget as any).customers?.phone || 'N/A'}</span></div>
                        <div><strong>Válido até:</strong><span>${budget.valid_until ? new Date(budget.valid_until + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                    </div>
                </div>
                <div class="items-section">
                    <h2>Itens do Orçamento</h2>
                    <table class="items-table">
                        <thead><tr><th style="width: 50%;">Produto</th><th style="text-align: center;">Qtd.</th><th style="text-align: right;">Preço Unit.</th><th style="text-align: right;">Subtotal</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                        <tfoot></tfoot>
                    </table>
                </div>
                <div class="footer">
                    <div class="footer-left">
                        <p>Atendido por: ${budget.employee_name || 'N/A'}</p>
                        <p>Data do Orçamento: ${new Date(budget.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <div class="footer-right">
                        <div class="total-box"><span>Valor Total</span>${budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

export const handlePrint = (budget: Budget) => {
    const htmlContent = getBudgetHtml(budget);
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) { printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus(); printWindow.print(); }
};

export const handleSaveAsPdf = (budget: Budget) => {
    const htmlContent = getBudgetHtml(budget);
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
            const elementToCapture = printWindow.document.body.children[0] as HTMLElement;
            if (elementToCapture) {
                html2canvas(elementToCapture).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(`orcamento-${budget.budget_code}.pdf`);
                    printWindow.close();
                });
            } else { printWindow.close(); }
        }, 500);
    }
};