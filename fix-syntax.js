import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

// The replacement we did earlier created strings like:
// } catch (err: any) { return res.status(500).json({ detail: err.message }); }ch (e: any) {
// or } catch (err: any) { return res.status(500).json({ detail: err.message }); }ch(err: any) {

content = content.replace(/} catch \(err: any\) \{ return res\.status\(500\)\.json\(\{ detail: err\.message \}\); \}ch\s*\(.*?\)\s*\{?/g, '} catch (err: any) { return res.status(500).json({ detail: err.message }); }');

fs.writeFileSync('server/routes.ts', content);
console.log('Fixed syntax in routes.ts');
