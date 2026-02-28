/**
 * Google Apps Script for handling order data from Sejalan Meds Club
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Copy this entire code into the script editor
 * 3. Click "Deploy" > "New deployment"
 * 4. Select "Web app" as the type
 * 5. Set "Execute as" to your account
 * 6. Set "Who has access" to "Anyone"
 * 7. Click "Deploy" and copy the Web App URL
 * 8. In Firebase, create document at /sheet/sheet1 with field "url" containing the Web App URL
 */

// Spreadsheet headers - One row per item
const HEADERS = [
  "Order ID",
  "Nama Lengkap",
  "Nomor HP",
  "Email",
  "Universitas",
  "Angkatan",
  "Item Name",
  "Item Type",
  "Qty",
  "Price",
  "Subtotal",
  "Order Total",
  "Payment Method",
  "Alamat Lengkap",
  "Kode Pos",
  "Shipping Method",
  "Shipping Cost",
  "Instagram",
  "Name Tags",
  "Discount Applied",
  "Instagram Proof", // Proof of repost for discount
  "Status",
  "Order Date",
  "Updated At",
  "Payment Proof"
];

// Folder name for storing payment proofs in Google Drive
const PROOF_FOLDER_NAME = "Sejalan_Payment_Proofs";

// Sheet names
const KELAS_SHEET_NAME = "Kelas & Webinar";
const SHOP_SHEET_NAME = "Shop Products";

// Determine if item types contain kelas/webinar
function isKelasOrder(itemTypes) {
  if (!itemTypes) return false;
  const types = itemTypes.toLowerCase();
  return types.includes("kelas") || types.includes("webinar");
}

// Determine if item types contain shop products
function isShopOrder(itemTypes) {
  if (!itemTypes) return false;
  const types = itemTypes.toLowerCase();
  // Shop products are anything that's NOT kelas or webinar
  const typeList = types.split(",").map(t => t.trim());
  return typeList.some(t => t !== "kelas" && t !== "webinar" && t !== "");
}

// Get the appropriate sheet(s) for an order
function getOrderSheets(ss, itemTypes) {
  const sheets = [];
  
  if (isKelasOrder(itemTypes)) {
    sheets.push(ss.getSheetByName(KELAS_SHEET_NAME) || createOrderSheet(ss, KELAS_SHEET_NAME));
  }
  
  if (isShopOrder(itemTypes)) {
    sheets.push(ss.getSheetByName(SHOP_SHEET_NAME) || createOrderSheet(ss, SHOP_SHEET_NAME));
  }
  
  // Fallback: if no type detected, use Kelas sheet
  if (sheets.length === 0) {
    sheets.push(ss.getSheetByName(KELAS_SHEET_NAME) || createOrderSheet(ss, KELAS_SHEET_NAME));
  }
  
  return sheets;
}

// Handle POST requests
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if we received an items array (new format)
    if (payload.items && Array.isArray(payload.items)) {
      let createdCount = 0;
      let updatedCount = 0;
      
      // Track uploaded proofs per order ID to avoid duplicate uploads
      const uploadedProofs = {};
      const uploadedIgProofs = {};
      
      for (let i = 0; i < payload.items.length; i++) {
        const item = payload.items[i];
        const orderId = item.orderId || "";
        
        // Determine which sheet based on item type
        const itemType = (item.itemType || "").toLowerCase();
        const isKelas = itemType === "kelas" || itemType === "webinar";
        const sheetName = isKelas ? KELAS_SHEET_NAME : SHOP_SHEET_NAME;
        const sheet = ss.getSheetByName(sheetName) || createOrderSheet(ss, sheetName);
        
        // Only upload proof for first item of each order ID
        let proofToUpload = null;
        let igProofToUpload = null;
        
        if (item.proofImage && !uploadedProofs[orderId]) {
          proofToUpload = item.proofImage;
          uploadedProofs[orderId] = true; // Mark as will be uploaded
        }
        
        if (item.instagramProof && !uploadedIgProofs[orderId]) {
          igProofToUpload = item.instagramProof;
          uploadedIgProofs[orderId] = true; // Mark as will be uploaded
        }
        
        // Create modified item with only first item getting the proof
        const itemToProcess = {
          ...item,
          proofImage: proofToUpload,
          instagramProof: igProofToUpload,
          isFirstItem: (i === 0 || !uploadedProofs[orderId]) // Flag for reference
        };
        
        if (item.action === "create") {
          createItemRow(sheet, itemToProcess);
          createdCount++;
        } else if (item.action === "update") {
          updateItemRow(sheet, itemToProcess);
          updatedCount++;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        created: createdCount,
        updated: updatedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Legacy: single item format
    const data = payload;
    if (data.action === "create") {
      const itemType = (data.itemType || data.itemTypes || "").toLowerCase();
      const isKelas = itemType.includes("kelas") || itemType.includes("webinar");
      const sheetName = isKelas ? KELAS_SHEET_NAME : SHOP_SHEET_NAME;
      const sheet = ss.getSheetByName(sheetName) || createOrderSheet(ss, sheetName);
      return createItemRow(sheet, data);
    } else if (data.action === "update") {
      return updateOrderInAllSheets(ss, data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "Unknown action" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Update order in all sheets (search both sheets for the order ID)
function updateOrderInAllSheets(ss, data) {
  const sheetNames = [KELAS_SHEET_NAME, SHOP_SHEET_NAME];
  let updated = false;
  
  for (const sheetName of sheetNames) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const result = updateOrder(sheet, data);
      const resultData = JSON.parse(result.getContent());
      if (resultData.success) {
        updated = true;
      }
    }
  }
  
  if (updated) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      action: "update",
      orderId: data.orderId 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    success: false, 
    error: "Order not found in any sheet" 
  })).setMimeType(ContentService.MimeType.JSON);
}

// Handle GET requests (for testing)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    message: "Sejalan Meds Club Order Sheet API is running" 
  })).setMimeType(ContentService.MimeType.JSON);
}

// Create an Orders sheet with headers if it doesn't exist
function createOrderSheet(ss, sheetName) {
  const sheet = ss.insertSheet(sheetName);
  
  // Set headers
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#0aa678");
  headerRange.setFontColor("#ffffff");
  
  // Set column widths
  sheet.setColumnWidth(1, 200);  // Order ID
  sheet.setColumnWidth(2, 150);  // Nama Lengkap
  sheet.setColumnWidth(3, 120);  // Nomor HP
  sheet.setColumnWidth(4, 180);  // Email
  sheet.setColumnWidth(5, 180);  // Universitas
  sheet.setColumnWidth(6, 80);   // Angkatan
  sheet.setColumnWidth(7, 200);  // Item Name
  sheet.setColumnWidth(8, 80);   // Item Type
  sheet.setColumnWidth(9, 50);   // Qty
  sheet.setColumnWidth(10, 100); // Price
  sheet.setColumnWidth(11, 100); // Subtotal
  sheet.setColumnWidth(12, 100); // Order Total
  sheet.setColumnWidth(13, 100); // Payment Method
  sheet.setColumnWidth(14, 250); // Alamat Lengkap
  sheet.setColumnWidth(15, 80);  // Kode Pos
  sheet.setColumnWidth(16, 100); // Shipping Method
  sheet.setColumnWidth(17, 80);  // Shipping Cost
  sheet.setColumnWidth(18, 120); // Instagram
  sheet.setColumnWidth(19, 200); // Name Tags
  sheet.setColumnWidth(20, 80);  // Discount Applied
  sheet.setColumnWidth(21, 100); // Instagram Proof
  sheet.setColumnWidth(22, 130); // Status
  sheet.setColumnWidth(23, 150); // Order Date
  sheet.setColumnWidth(24, 150); // Updated At
  sheet.setColumnWidth(25, 100); // Payment Proof
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  return sheet;
}

// Create a new row for a single item
function createItemRow(sheet, data) {
  // Save payment proof image to Drive if provided
  let proofUrl = "";
  if (data.proofImage) {
    proofUrl = saveProofImage(data.proofImage, data.orderId);
  }
  
  // Save Instagram proof image (for discount) if provided
  let instagramProofUrl = "";
  if (data.instagramProof) {
    instagramProofUrl = saveProofImage(data.instagramProof, data.orderId + "_ig");
  }
  
  const row = [
    data.orderId || "",
    data.namaLengkap || "",
    data.nomorHP || "",
    data.userEmail || "",
    data.universitas || "",
    data.angkatan || "",
    data.itemName || "",
    data.itemType || "",
    data.itemQty || 1,
    data.itemPrice || 0,
    data.itemSubtotal || 0,
    data.orderTotal || 0,
    data.paymentMethod || "",
    data.alamatLengkap || "",
    data.kodePos || "",
    data.shippingMethod || "",
    data.shippingCost || 0,
    data.instagramAccount || "",
    data.nameTags || "",             // Name Tags column (19)
    data.hasDiscount ? "Yes" : "No", // Discount Applied column (20)
    instagramProofUrl,               // Instagram Proof column (21)
    data.status || "pending_verification", // Status column (22)
    data.orderDate || new Date().toISOString(), // Order Date (23)
    data.updatedAt || new Date().toISOString(), // Updated At (24)
    proofUrl                         // Payment Proof column (25)
  ];
  
  sheet.appendRow(row);
  
  // Apply conditional formatting to the status column for the new row
  const lastRow = sheet.getLastRow();
  applyStatusFormatting(sheet, lastRow, data.status);
  
  // Make Instagram proof URL clickable if exists
  if (instagramProofUrl && instagramProofUrl.startsWith("http")) {
    const igProofCell = sheet.getRange(lastRow, 21);
    igProofCell.setFormula(`=HYPERLINK("${instagramProofUrl}", "View IG Proof")`);
  }
  
  // Make payment proof URL clickable if exists
  if (proofUrl && proofUrl.startsWith("http")) {
    const proofCell = sheet.getRange(lastRow, 25); // Payment Proof is now column 25
    proofCell.setFormula(`=HYPERLINK("${proofUrl}", "View Proof")`);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    action: "create",
    orderId: data.orderId,
    itemName: data.itemName,
    proofUrl: proofUrl
  })).setMimeType(ContentService.MimeType.JSON);
}

// Update a single item row
function updateItemRow(sheet, data) {
  const orderId = data.orderId;
  const itemName = data.itemName;
  
  if (!orderId) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "Order ID is required for update" 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Find rows with matching order ID and item name
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  let updated = false;
  for (let i = 1; i < values.length; i++) {
    // Check Order ID (column 1) and optionally Item Name (column 7)
    if (values[i][0] === orderId) {
      // If itemName provided, match it too; otherwise update all rows for this order
      if (!itemName || values[i][6] === itemName) {
        const rowIndex = i + 1;
        
        // Update status (column 22 - after Name Tags, Discount Applied, and Instagram Proof)
        if (data.status) {
          sheet.getRange(rowIndex, 22).setValue(data.status);
          applyStatusFormatting(sheet, rowIndex, data.status);
        }
        
        // Update timestamp (column 24)
        sheet.getRange(rowIndex, 24).setValue(data.updatedAt || new Date().toISOString());
        
        // Handle Instagram proof image (column 21)
        if (data.instagramProof) {
          const igProofUrl = saveProofImage(data.instagramProof, orderId + "_ig");
          if (igProofUrl && igProofUrl.startsWith("http")) {
            sheet.getRange(rowIndex, 21).setFormula(`=HYPERLINK("${igProofUrl}", "View IG Proof")`);
          }
        }
        
        // Handle payment proof image (column 25)
        if (data.proofImage) {
          const proofUrl = saveProofImage(data.proofImage, orderId);
          if (proofUrl && proofUrl.startsWith("http")) {
            sheet.getRange(rowIndex, 25).setFormula(`=HYPERLINK("${proofUrl}", "View Proof")`);
          }
        }
        
        updated = true;
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    success: updated, 
    action: "update",
    orderId: orderId
  })).setMimeType(ContentService.MimeType.JSON);
}

// Update an existing order
function updateOrder(sheet, data) {
  const orderId = data.orderId;
  if (!orderId) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "Order ID is required for update" 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Find the row with matching order ID
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) { // Start from 1 to skip header
    if (values[i][0] === orderId) {
      rowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }
  
  if (rowIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "Order not found" 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Update fields that are provided
  // Status is now column 22 (after Name Tags, Discount Applied, and Instagram Proof)
  if (data.status) {
    sheet.getRange(rowIndex, 22).setValue(data.status);
    applyStatusFormatting(sheet, rowIndex, data.status);
  }
  // Updated At is now column 24
  if (data.updatedAt) {
    sheet.getRange(rowIndex, 24).setValue(data.updatedAt);
  } else {
    sheet.getRange(rowIndex, 24).setValue(new Date().toISOString());
  }
  
  // Handle Instagram proof image upload - column 21
  if (data.instagramProof) {
    const igProofUrl = saveProofImage(data.instagramProof, orderId + "_ig");
    if (igProofUrl && igProofUrl.startsWith("http")) {
      const igProofCell = sheet.getRange(rowIndex, 21);
      igProofCell.setFormula(`=HYPERLINK("${igProofUrl}", "View IG Proof")`);
    }
  }
  
  // Handle payment proof image upload - column 25
  let proofUrl = "";
  if (data.proofImage) {
    proofUrl = saveProofImage(data.proofImage, orderId);
    if (proofUrl && proofUrl.startsWith("http")) {
      const proofCell = sheet.getRange(rowIndex, 25);
      proofCell.setFormula(`=HYPERLINK("${proofUrl}", "View Proof")`);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    action: "update",
    orderId: orderId,
    proofUrl: proofUrl
  })).setMimeType(ContentService.MimeType.JSON);
}

// Apply conditional formatting based on status
function applyStatusFormatting(sheet, row, status) {
  const statusCell = sheet.getRange(row, 22); // Status is column 22 (after Name Tags, Discount Applied, and Instagram Proof)
  
  const statusColors = {
    "pending_verification": { bg: "#fef3c7", text: "#92400e" },
    "verified": { bg: "#d1fae5", text: "#065f46" },
    "processing": { bg: "#dbeafe", text: "#1e40af" },
    "shipped": { bg: "#ede9fe", text: "#5b21b6" },
    "completed": { bg: "#a7f3d0", text: "#047857" },
    "cancelled": { bg: "#fee2e2", text: "#991b1b" }
  };
  
  const colors = statusColors[status] || { bg: "#f3f4f6", text: "#374151" };
  statusCell.setBackground(colors.bg);
  statusCell.setFontColor(colors.text);
  statusCell.setFontWeight("bold");
}

// Utility function to format currency
function formatRupiah(num) {
  return "Rp " + Number(num).toLocaleString("id-ID");
}

// Get or create folder for payment proofs
function getProofFolder() {
  const folders = DriveApp.getFoldersByName(PROOF_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  // Create folder if it doesn't exist
  return DriveApp.createFolder(PROOF_FOLDER_NAME);
}

// Save base64 image to Google Drive and return the URL
function saveProofImage(base64Data, orderId) {
  if (!base64Data || !base64Data.includes(",")) {
    return "";
  }
  
  try {
    // Extract the base64 content (remove data:image/...;base64, prefix)
    const parts = base64Data.split(",");
    const contentType = parts[0].match(/data:(.*);base64/)[1] || "image/png";
    const base64Content = parts[1];
    
    // Determine file extension
    let extension = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      extension = "jpg";
    } else if (contentType.includes("gif")) {
      extension = "gif";
    } else if (contentType.includes("webp")) {
      extension = "webp";
    }
    
    // Create blob from base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Content),
      contentType,
      `proof_${orderId}_${new Date().getTime()}.${extension}`
    );
    
    // Save to Drive folder
    const folder = getProofFolder();
    const file = folder.createFile(blob);
    
    // Make file accessible via link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return the view URL
    return file.getUrl();
  } catch (error) {
    console.error("Error saving proof image:", error);
    return "Error: " + error.toString();
  }
}

// ==========================================
// PIVOT TABLE / SUMMARY FUNCTIONS
// ==========================================

const SUMMARY_SHEET_NAME = "Item Summary";

/**
 * Parse item name and return array of {name, qty} objects
 * Handles special cases:
 * - "1 Set X (A - B - C)" → 1 A, 1 B, 1 C
 * - "Sejalan X - A (2 set), B (2 set), C (2), D (2)" → 2 A, 2 B, 2 C, 2 D
 */
function parseItemName(itemName, baseQty) {
  // Handle null, undefined, or non-string values
  if (!itemName || typeof itemName !== 'string') return [];
  
  const name = String(itemName).trim();
  if (!name) return [];
  
  const nameLower = name.toLowerCase();
  const results = [];
  
  // Ensure baseQty is a valid number
  baseQty = Number(baseQty) || 1;
  
  // Case 1: "1 Set X (A - B - C)"
  if (nameLower.startsWith("1 set")) {
    // Find content in parentheses
    const match = name.match(/\(([^)]+)\)/);
    if (match) {
      const components = match[1].split(/\s*-\s*/);
      for (const comp of components) {
        const cleanName = comp.trim();
        if (cleanName) {
          results.push({ name: cleanName, qty: baseQty });
        }
      }
    } else {
      // No parentheses, just use the whole name
      results.push({ name: name, qty: baseQty });
    }
    return results;
  }
  
  // Case 2: "Sejalan X - A (2 set), B (2 set), C (2), D (2)"
  if (nameLower.startsWith("sejalan")) {
    // Remove "Sejalan X - " prefix and parse the rest
    const dashIndex = name.indexOf(" - ");
    if (dashIndex !== -1) {
      const itemsPart = name.substring(dashIndex + 3);
      // Split by comma
      const items = itemsPart.split(/\s*,\s*/);
      
      for (const item of items) {
        // Parse "ItemName (qty)" or "ItemName (qty set)"
        const itemMatch = item.match(/^(.+?)\s*\((\d+)(?:\s*set)?\)\s*$/i);
        if (itemMatch) {
          const itemName = itemMatch[1].trim();
          const itemQty = parseInt(itemMatch[2], 10) || 1;
          if (itemName) {
            results.push({ name: itemName, qty: itemQty * baseQty });
          }
        } else {
          // No qty in parentheses, use as-is
          const cleanItem = item.trim();
          if (cleanItem) {
            results.push({ name: cleanItem, qty: baseQty });
          }
        }
      }
    } else {
      // No dash found, use whole name
      results.push({ name: name, qty: baseQty });
    }
    return results;
  }
  
  // Default case: just use the item name as-is
  results.push({ name: name, qty: baseQty });
  return results;
}

/**
 * Refresh the Item Summary pivot table
 * Call this from the menu or manually
 */
function refreshItemSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shopSheet = ss.getSheetByName(SHOP_SHEET_NAME);
    
    if (!shopSheet) {
      SpreadsheetApp.getUi().alert("Sheet '" + SHOP_SHEET_NAME + "' not found! Please create some orders first.");
      return;
    }
    
    // Get or create summary sheet
    let summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    if (!summarySheet) {
      summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
    } else {
      summarySheet.clear();
    }
    
    // Read data from Shop Products sheet
    const dataRange = shopSheet.getDataRange();
    const values = dataRange.getValues();
    
    Logger.log("Total rows in Shop Products: " + values.length);
    
    if (values.length < 2) {
      summarySheet.getRange(1, 1).setValue("No data in Shop Products sheet");
      return;
    }
    
    // Log headers to verify column positions
    Logger.log("Headers (raw): " + JSON.stringify(values[0]));
    
    // Find column indices dynamically by header name (more robust)
    const headers = values[0].map(h => String(h).toLowerCase().trim());
    Logger.log("Headers (normalized): " + JSON.stringify(headers));
    
    let ITEM_NAME_COL = headers.indexOf("item name");
    let QTY_COL = headers.indexOf("qty");
    let STATUS_COL = headers.indexOf("status");
    
    Logger.log("Found indices - Item Name: " + ITEM_NAME_COL + ", Qty: " + QTY_COL + ", Status: " + STATUS_COL);
    
    // Fallback to fixed indices if headers not found
    if (ITEM_NAME_COL === -1) ITEM_NAME_COL = 6;
    if (QTY_COL === -1) QTY_COL = 8;
    if (STATUS_COL === -1) STATUS_COL = 21;
    
    Logger.log("Final column indices - Item Name: " + ITEM_NAME_COL + ", Qty: " + QTY_COL + ", Status: " + STATUS_COL);
    
    // Log first data row for debugging
    if (values.length > 1) {
      Logger.log("First data row: " + JSON.stringify(values[1]));
      Logger.log("Status value at column " + STATUS_COL + ": '" + values[1][STATUS_COL] + "'");
    }
    
    // Aggregate items
    const itemTotals = {};
    let processedCount = 0;
    let skippedCount = 0;
    let statusValues = []; // Track unique status values for debugging
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // Skip empty rows
      if (!row || row.length === 0) {
        skippedCount++;
        continue;
      }
      
      const itemName = row[ITEM_NAME_COL];
      const qty = Number(row[QTY_COL]) || 0;
      const rawStatus = row[STATUS_COL];
      const status = String(rawStatus || "").toLowerCase().trim();
      
      // Track unique status values (first 10)
      if (statusValues.length < 10 && !statusValues.includes(status)) {
        statusValues.push(status);
      }
      
      // Count verified, completed, and pending_verification orders
      // Only skip cancelled orders
      if (status !== "verified") {
        skippedCount++;
        continue;
      }
      
      // Parse the item name (handles special cases)
      const parsedItems = parseItemName(itemName, qty);
      
      for (const item of parsedItems) {
        if (!item.name) continue;
        
        const key = item.name.toLowerCase(); // Case-insensitive grouping
        if (!itemTotals[key]) {
          itemTotals[key] = { 
            displayName: item.name, // Keep original case for display
            totalQty: 0 
          };
        }
        itemTotals[key].totalQty += item.qty;
      }
      processedCount++;
    }
    
    Logger.log("Processed: " + processedCount + ", Skipped (cancelled/empty): " + skippedCount);
    Logger.log("Unique status values found: " + JSON.stringify(statusValues));
    
    // Sort by total quantity (descending)
    const sortedItems = Object.entries(itemTotals)
      .sort((a, b) => b[1].totalQty - a[1].totalQty);
    
    // Write headers
    summarySheet.getRange(1, 1, 1, 3).setValues([["Item Name", "Total Qty", "Last Updated"]]);
    summarySheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#0aa678").setFontColor("#ffffff");
    
    // Write data
    if (sortedItems.length > 0) {
      const summaryData = sortedItems.map(([key, data]) => [
        data.displayName,
        data.totalQty,
        ""
      ]);
      summarySheet.getRange(2, 1, summaryData.length, 3).setValues(summaryData);
      
      // Add last updated timestamp
      summarySheet.getRange(2, 3).setValue(new Date().toISOString());
    } else {
      summarySheet.getRange(2, 1).setValue("No orders found (only cancelled orders are excluded)");
    }
    
    // Set column widths
    summarySheet.setColumnWidth(1, 300);
    summarySheet.setColumnWidth(2, 100);
    summarySheet.setColumnWidth(3, 200);
    
    // Freeze header row
    summarySheet.setFrozenRows(1);
    
    // Add note about auto-refresh
    summarySheet.getRange(sortedItems.length + 3, 1).setValue("Note: Run 'Refresh Item Summary' from menu to update this table");
    summarySheet.getRange(sortedItems.length + 3, 1).setFontStyle("italic").setFontColor("#6b7280");
    
    Logger.log("Item Summary refreshed successfully! " + sortedItems.length + " unique items.");
    
  } catch (error) {
    Logger.log("ERROR in refreshItemSummary: " + error.message);
    Logger.log("Stack: " + error.stack);
    SpreadsheetApp.getUi().alert("Error refreshing summary: " + error.message);
  }
}

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Sejalan Tools')
    .addItem('Refresh Item Summary', 'refreshItemSummary')
    .addItem('Initialize All Sheets', 'initializeAllSheets')
    .addToUi();
}

/**
 * Initialize all sheets including summary
 * Can be run manually to set up the spreadsheet
 */
function initializeAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Kelas & Webinar sheet if not exists
  if (!ss.getSheetByName(KELAS_SHEET_NAME)) {
    createOrderSheet(ss, KELAS_SHEET_NAME);
    SpreadsheetApp.getUi().alert("Created: " + KELAS_SHEET_NAME);
  }
  
  // Create Shop Products sheet if not exists
  if (!ss.getSheetByName(SHOP_SHEET_NAME)) {
    createOrderSheet(ss, SHOP_SHEET_NAME);
    SpreadsheetApp.getUi().alert("Created: " + SHOP_SHEET_NAME);
  }
  
  // Create Item Summary sheet
  refreshItemSummary();
  
  SpreadsheetApp.getUi().alert("All sheets initialized!");
}

/**
 * Test function - run this to verify the script works
 */
function testCreateSummary() {
  Logger.log("Starting test...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Spreadsheet: " + ss.getName());
  
  // Create summary sheet
  let summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
    Logger.log("Created new summary sheet");
  } else {
    Logger.log("Summary sheet already exists");
  }
  
  // Write test data
  summarySheet.getRange(1, 1).setValue("Item Summary - Test");
  summarySheet.getRange(2, 1).setValue("Created at: " + new Date().toISOString());
  
  Logger.log("Test complete!");
}

