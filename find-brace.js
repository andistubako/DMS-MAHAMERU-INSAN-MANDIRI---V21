import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

let depth = 0;
let lastLines = [];
let lines = content.split('\n');
for (let i=0; i<lines.length; i++) {
  let line = lines[i];
  for (let j=0; j<line.length; j++) {
    if (line[j] === '{') {
      depth++;
      lastLines.push(i+1);
    }
    if (line[j] === '}') {
      depth--;
      lastLines.pop();
    }
  }
}
console.log('Final depth:', depth);
console.log('Unclosed braces opened at lines:', lastLines.slice(-10));
