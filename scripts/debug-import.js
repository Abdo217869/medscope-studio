import { validateScheduleJson } from '../src/utils/schemaValidator.js';
import fs from 'fs';

const exportedContent = fs.readFileSync('reference/foundation_project.json', 'utf8');
const parsed = JSON.parse(exportedContent);
const res = validateScheduleJson(parsed);
console.log('Validation of foundation_project.json:', res);

