// Whoosh for Google Docs.
//
// The sidebar shows the Whoosh web app (/addon) in a frame. Everything
// that touches the document happens here: reading the script, marking each
// reference with its verdict color, selecting a reference, and applying a swap.
// The web app addresses text by its offset in the script it was sent, so every
// function below agrees on one view of the document: its paragraphs' text
// joined with "\n".

// Verdict colors. Clearing removes exactly these, so a writer's own
// highlighting is never touched.
var COLORS = ['#cfedcf', '#fde4ad', '#f4cfcf', '#e4e4e1', '#efefed'];

function onOpen() {
  DocumentApp.getUi().createMenu('Whoosh').addItem('Check this room', 'showSidebar').addToUi();
}

function onInstall() {
  onOpen();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Whoosh');
  DocumentApp.getUi().showSidebar(html);
}

// The script to check: the selection when there is one, else the whole
// document. `base` is where it starts in the document.
function getScript() {
  var lay = layout_();
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    var parts = [];
    selection.getRangeElements().forEach(function (re) {
      var el = re.getElement();
      var text = el.getType() === DocumentApp.ElementType.TEXT ? el.asText().getText() : el.getText ? el.getText() : '';
      text = clean_(text);
      parts.push(re.isPartial() ? text.substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1) : text);
    });
    var picked = parts.join('\n');
    var at = picked.trim() ? lay.text.indexOf(picked) : -1;
    if (at >= 0) return { text: picked, base: at, selection: true };
  }
  return { text: lay.text, base: 0, selection: false };
}

// Fills an empty document with an example script.
function insertExample(text) {
  var body = DocumentApp.getActiveDocument().getBody();
  if (layout_().text.trim()) throw new Error('This document already has text. Open a new, empty document to try an example.');
  var lines = String(text).split('\n');
  body.clear();
  body.getParagraphs()[0].setText(lines[0]);
  for (var i = 1; i < lines.length; i++) body.appendParagraph(lines[i]);
  return true;
}

// Colors each mark ({quote, at, color}); clears earlier marks first.
function paint(marks) {
  var lay = layout_();
  clear_(lay);
  var painted = 0;
  (marks || []).forEach(function (mark) {
    var hit = find_(lay, mark.quote, mark.at);
    if (!hit) return;
    hit.paragraph.editAsText().setBackgroundColor(hit.offset, hit.offset + mark.quote.length - 1, mark.color);
    painted++;
  });
  return painted;
}

function clear() {
  clear_(layout_());
  return true;
}

// Selects a mark's text, which also scrolls the document to it.
function select(mark) {
  var lay = layout_();
  var hit = find_(lay, mark.quote, mark.at);
  if (!hit) return false;
  // A range needs the text element itself, not the paragraph.
  var offset = 0;
  for (var i = 0; i < hit.paragraph.getNumChildren(); i++) {
    var child = hit.paragraph.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TEXT) continue;
    var length = child.asText().getText().length;
    if (hit.offset < offset + length) {
      var start = hit.offset - offset;
      var end = Math.min(hit.offset + mark.quote.length, offset + length) - offset - 1;
      var doc = DocumentApp.getActiveDocument();
      doc.setSelection(doc.newRange().addElement(child.asText(), start, end).build());
      return true;
    }
    offset += length;
  }
  return false;
}

// Applies a rewrite: finds the passage (`before`, near `at`) and makes each
// change ({at, remove, insert}, relative to the passage) in place, so the
// formatting of the words that stay is kept.
function apply(change) {
  var lay = layout_();
  var start = nearest_(lay.text, change.before, change.at);
  if (start < 0) throw new Error('That line has changed since the check. Run the check again to get fresh swaps.');
  var steps = change.ops.map(function (op) {
    var spot = locate_(lay, start + op.at);
    if (spot.offset + op.remove > lay.texts[spot.index].length) throw new Error('That change spans two paragraphs, so it has to be made by hand.');
    return { op: op, spot: spot };
  });
  // Last change first, so earlier offsets stay valid.
  steps.sort(function (a, b) {
    return b.op.at - a.op.at;
  });
  steps.forEach(function (step) {
    var text = lay.paragraphs[step.spot.index].editAsText();
    var offset = step.spot.offset;
    if (step.op.remove) text.deleteText(offset, offset + step.op.remove - 1);
    if (!step.op.insert) return;
    if (offset >= text.getText().length) text.appendText(step.op.insert);
    else text.insertText(offset, step.op.insert);
    text.setBackgroundColor(offset, offset + step.op.insert.length - 1, change.color || null);
  });
  return true;
}

// Soft line breaks come back as \r or \v; one character for one keeps offsets aligned.
function clean_(text) {
  return text.replace(/[\r\v]/g, '\n');
}

function layout_() {
  var paragraphs = DocumentApp.getActiveDocument().getBody().getParagraphs();
  var texts = [];
  var starts = [];
  var position = 0;
  paragraphs.forEach(function (p) {
    var text = clean_(p.getText());
    starts.push(position);
    texts.push(text);
    position += text.length + 1;
  });
  return { paragraphs: paragraphs, texts: texts, starts: starts, text: texts.join('\n') };
}

// The paragraph that holds a document offset.
function locate_(lay, at) {
  var index = 0;
  while (index + 1 < lay.starts.length && lay.starts[index + 1] <= at) index++;
  return { index: index, offset: at - lay.starts[index] };
}

// The occurrence of `needle` closest to where it was when the script was sent.
function nearest_(text, needle, hint) {
  if (!needle) return -1;
  var best = -1;
  for (var i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
    if (best < 0 || Math.abs(i - hint) < Math.abs(best - hint)) best = i;
  }
  return best;
}

function find_(lay, quote, hint) {
  var at = nearest_(lay.text, quote, hint);
  if (at < 0) return null;
  var spot = locate_(lay, at);
  if (spot.offset + quote.length > lay.texts[spot.index].length) return null;
  return { paragraph: lay.paragraphs[spot.index], offset: spot.offset };
}

function clear_(lay) {
  lay.paragraphs.forEach(function (p, index) {
    var length = lay.texts[index].length;
    if (!length) return;
    var text = p.editAsText();
    var runs = text.getTextAttributeIndices();
    for (var k = 0; k < runs.length; k++) {
      var start = runs[k];
      var end = (k + 1 < runs.length ? runs[k + 1] : length) - 1;
      var color = text.getBackgroundColor(start);
      if (color && COLORS.indexOf(color.toLowerCase()) >= 0) text.setBackgroundColor(start, end, null);
    }
  });
}
