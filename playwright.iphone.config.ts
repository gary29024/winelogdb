import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base,{
 projects:base.projects!.filter(project=>project.name?.startsWith('iPhone')),
});
