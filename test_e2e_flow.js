const { chromium } = require('playwright');

async function runTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to app
    await page.goto('http://localhost:3000');
    console.log('✓ App loaded');

    // Step 1: Login as super admin
    await page.fill('input[placeholder="Usuario"]', 'superadmin');
    await page.fill('input[placeholder="Contraseña"]', 'superadmin123');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL(/\/(home|companies)/, { timeout: 10000 });
    console.log('✓ Super admin logged in');

    // Step 2: Navigate to Companies page
    await page.click('text=Empresas');
    await page.waitForURL('**/companies', { timeout: 5000 });
    console.log('✓ Companies page loaded');

    // Step 3: Create a test company
    const companyName = `Test Co ${Date.now()}`;
    await page.fill('input[placeholder="Ej: Mi Empresa"]', companyName);
    await page.fill('input[placeholder="Ej: mi-empresa"]', `test-${Date.now()}`);
    await page.click('button:has-text("Crear Empresa")');
    await page.waitForTimeout(2000);
    console.log('✓ Company created:', companyName);

    // Step 4: Click "Gestionar" on the new company
    const companies = await page.locator('.company-card');
    const count = await companies.count();
    console.log(`✓ Found ${count} companies on page`);
    
    // Get the last company (the one we just created)
    const lastCompanyCard = companies.nth(count - 1);
    const gestionar = lastCompanyCard.locator('button:has-text("Gestionar")');
    await gestionar.click();
    await page.waitForTimeout(1000);
    console.log('✓ Manage users modal opened');

    // Step 5: Create an operator user
    const operatorName = `Operator ${Date.now()}`;
    const operatorUsername = `op${Date.now()}`;
    await page.fill('input[placeholder="usuario123"]', operatorUsername);
    await page.fill('input[placeholder="••••••••"]', 'superadmin123');
    await page.fill('input[placeholder="Juan Pérez"]', operatorName);
    
    // Select operator role from dropdown
    const roleSelect = page.locator('select');
    await roleSelect.selectOption('operator');
    
    await page.click('button:has-text("Crear Usuario")');
    await page.waitForTimeout(2000);
    console.log('✓ Operator user created:', operatorName);

    // Step 6: Close the modal first
    await page.click('.close-btn');
    await page.waitForTimeout(500);
    
    // Then logout super admin
    await page.click('button:has-text("Salir")');
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('✓ Super admin logged out');

    // Step 7: Login as operator
    await page.fill('input[placeholder="Usuario"]', operatorUsername);
    await page.fill('input[placeholder="Contraseña"]', 'superadmin123');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForTimeout(2000);
    
    const url = page.url();
    console.log('✓ Operator logged in, URL:', url);

    // Step 8: Verify operator dashboard displays
    const statsBar = page.locator('.stats-bar');
    await statsBar.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Operator dashboard loaded with stats');

    // Step 9: Verify client list panel
    const clientListPanel = page.locator('.client-list-panel');
    await clientListPanel.waitFor({ state: 'visible', timeout: 5000 });
    const searchInput = page.locator('.search-input');
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Client list panel visible');

    // Step 10: Verify call panel
    const callPanel = page.locator('.call-panel');
    await callPanel.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Call panel visible');

    // Step 11: Check if there are any clients assigned
    const emptyMessage = page.locator('text=No hay clientes asignados');
    
    if (await emptyMessage.isVisible()) {
      console.log('✓ No clients assigned (expected for new company)');
    } else {
      const clientCount = await page.locator('.client-card').count();
      console.log(`✓ Found ${clientCount} assigned clients`);
      
      // If clients exist, try to select and log a call
      const firstClient = page.locator('.client-card').first();
      await firstClient.click();
      await page.waitForTimeout(500);
      
      const callForm = page.locator('.call-form');
      await callForm.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✓ Call form displayed for selected client');
      
      // Select a status
      const statusButton = page.locator('button:has-text("Aceptó")').first();
      await statusButton.click();
      await page.waitForTimeout(300);
      console.log('✓ Status selected');
      
      // Add notes
      await page.fill('textarea', 'Test call - automated test');
      console.log('✓ Notes added');
      
      // Register call
      await page.click('button:has-text("Guardar llamada")');
      await page.waitForTimeout(1000);
      console.log('✓ Call registered');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
