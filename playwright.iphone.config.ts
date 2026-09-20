import { defineConfig,devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base,{
 testMatch:'iphone-layout.spec.ts',
 testIgnore:[],
 projects:['iPhone 15 Pro','iPhone 15 Pro Max'].map(name=>({name,use:{...devices[name],browserName:'webkit'}})),
});
