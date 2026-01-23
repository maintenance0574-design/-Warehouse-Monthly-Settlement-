/**
 * 倉儲月結管理系統 - 後端核心腳本 (v5.3 操作人員欄位擴充版)
 */

var CATEGORIES = ["進貨", "用料", "建置", "維修"];

// 一般類別標題列
var DEFAULT_HEADERS = [
  "id", "date", "type", "materialName", "materialNumber", 
  "機台編號", "quantity", "unitPrice", "total", "note", 
  "機台種類", "帳目類別", "操作人員"
];

// 維修類別特定標題列
var REPAIR_HEADERS = [
  "id", "date", "type", "materialName", "materialNumber", 
  "機台編號", "sn", "故障原因", "quantity", "送修日期", 
  "完修日期", "note", "上機日期", "操作人員"
];

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allData = [];
  
  CATEGORIES.forEach(function(cat) {
    var sheet = ss.getSheetByName(cat);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        var rawHeaders = data[0];
        var normHeaders = rawHeaders.map(function(h) { return String(h).trim(); });
        
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var obj = {};
          normHeaders.forEach(function(h, hIdx) {
            obj[h] = row[hIdx];
          });
          obj["id"] = obj["id"] || row[0];
          obj["type"] = cat;
          allData.push(obj);
        }
      }
    }
  });

  return ContentService.createTextOutput(JSON.stringify(allData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var type = params.type; 
    var id = params.id;
    var payload = params.data;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(type);
    var targetHeaders = (type === "維修") ? REPAIR_HEADERS : DEFAULT_HEADERS;
    
    if (!sheet) {
      sheet = ss.insertSheet(type);
      sheet.appendRow(targetHeaders);
      sheet.getRange(1, 1, 1, targetHeaders.length)
           .setBackground("#1e293b")
           .setFontColor("#ffffff")
           .setFontWeight("bold");
    }

    var d = {};
    for (var k in payload) {
      d[k] = payload[k];
      d[String(k).toLowerCase()] = payload[k];
    }

    var rowData = targetHeaders.map(function(h) {
      if (h === "id") return String(id).trim();
      if (h === "date") return d["date"] || "";
      if (h === "type") return type;
      if (h === "materialName") return d["materialname"] || d["materialName"] || "";
      if (h === "materialNumber") return d["materialnumber"] || d["materialNumber"] || "";
      if (h === "機台編號") return d["機台編號"] || d["machinenumber"] || d["machineNumber"] || "";
      if (h === "quantity") return d["quantity"] || 0;
      if (h === "unitPrice") return d["unitprice"] || d["unitPrice"] || 0;
      if (h === "total") return d["total"] || 0;
      if (h === "note") return d["note"] || "";
      if (h === "操作人員") return d["操作人員"] || d["operator"] || "";
      if (h === "故障原因") return d["故障原因"] || d["faultreason"] || d["faultReason"] || "";
      if (h === "機台種類") return d["機台種類"] || d["machinecategory"] || d["machineCategory"] || "";
      if (h === "帳目類別") return d["帳目類別"] || d["accountcategory"] || d["accountCategory"] || "";
      if (h === "sn") return d["sn"] || "";
      if (h === "送修日期") return d["送修日期"] || d["sentdate"] || d["sentDate"] || "";
      if (h === "完修日期") return d["完修日期"] || d["repairdate"] || d["repairDate"] || "";
      if (h === "上機日期") return d["上機日期"] || d["installdate"] || d["installDate"] || "";
      return "";
    });

    if (action === 'insert') {
      sheet.appendRow(rowData);
    } else if (action === 'update') {
      var values = sheet.getDataRange().getValues();
      var rowIdx = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() == String(id).trim()) { rowIdx = i + 1; break; }
      }
      if (rowIdx !== -1) {
        sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    } else if (action === 'delete') {
      CATEGORIES.forEach(function(cat) {
        var s = ss.getSheetByName(cat);
        if (s) {
          var v = s.getDataRange().getValues();
          for (var i = v.length - 1; i >= 1; i--) {
            if (String(v[i][0]).trim() == String(id).trim()) s.deleteRow(i + 1);
          }
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({result: "ok"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}