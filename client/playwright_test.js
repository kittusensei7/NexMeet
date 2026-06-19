/* eslint-disable */
const { chromium } = require('playwright');

(async () => {
  console.log('Starting automated tests for NexMeet...');
  
  // 1. Launch browser (with chromium)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  // Create two separate browser contexts to isolate cookies, localStorage, etc.
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  // Grant camera/microphone permissions
  await context1.grantPermissions(['camera', 'microphone']);
  await context2.grantPermissions(['camera', 'microphone']);

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  console.log('Browser contexts created successfully.');

  try {
    // Helper function to fill fields safely (erase & type)
    async function clearAndType(page, selector, text) {
      await page.focus(selector);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.fill(selector, text);
    }

    // ==========================================
    // SEQUENCE 1: AUTH AND ROUTING VALIDATION
    // ==========================================
    console.log('Sequence 1: Auth and Routing Validation starting...');

    // 1. Navigate to register
    await page1.goto('http://localhost:5173/register');
    await page1.waitForLoadState('networkidle');
    console.log('Navigated to /register.');

    // 2. Fill registration details for userone1
    await clearAndType(page1, '#username', 'userone1');
    await clearAndType(page1, '#email', 'userone1234@example.com');
    await clearAndType(page1, '#password', 'userone1234');
    await clearAndType(page1, '#confirmPassword', 'userone1234');
    await page1.click('input[type="checkbox"]');
    console.log('Registration fields filled.');

    // Click Register button
    await page1.click('button[type="submit"]');
    console.log('Clicked Register button.');
    
    // Wait for redirect to /login
    await page1.waitForURL('**/login', { timeout: 10000 });
    console.log('Successfully redirected to /login.');

    // 3. Duplicate registration check
    await page1.goto('http://localhost:5173/register');
    await page1.waitForLoadState('networkidle');
    await clearAndType(page1, '#username', 'userone1');
    await clearAndType(page1, '#email', 'userone1234@example.com');
    await clearAndType(page1, '#password', 'userone1234');
    await clearAndType(page1, '#confirmPassword', 'userone1234');
    await page1.click('input[type="checkbox"]');
    await page1.click('button[type="submit"]');
    
    // Verify error message
    const errorTextElement = await page1.waitForSelector('.google-error-alert span', { timeout: 5000 });
    const errorText = await errorTextElement.innerText();
    console.log(`Duplicate registration error shown: "${errorText}"`);
    if (!errorText.toLowerCase().includes('already')) {
      throw new Error('Duplicate email registration error not showing properly');
    }

    // 4. Incorrect password check
    await page1.goto('http://localhost:5173/login');
    await page1.waitForLoadState('networkidle');
    await clearAndType(page1, '#email', 'userone1234@example.com');
    await clearAndType(page1, '#password', 'wrongpassword');
    await page1.click('button[type="submit"]');
    const loginErrorTextElement = await page1.waitForSelector('.google-error-alert span', { timeout: 5000 });
    const loginErrorText = await loginErrorTextElement.innerText();
    console.log(`Incorrect password error shown: "${loginErrorText}"`);
    if (!loginErrorText.toLowerCase().includes('password')) {
      throw new Error('Incorrect password error not showing properly');
    }

    // 5. Nonexistent user check
    await clearAndType(page1, '#email', 'nonexistent@example.com');
    await clearAndType(page1, '#password', 'Password123');
    await page1.click('button[type="submit"]');
    const nonexistentErrorTextElement = await page1.waitForSelector('.google-error-alert span', { timeout: 5000 });
    const nonexistentErrorText = await nonexistentErrorTextElement.innerText();
    console.log(`Nonexistent user error shown: "${nonexistentErrorText}"`);
    if (!nonexistentErrorText.toLowerCase().includes('not found')) {
      throw new Error('Nonexistent user error not showing properly');
    }

    // 6. Protected route check
    // Try visiting dashboard directly (we are not logged in yet)
    await page1.goto('http://localhost:5173/dashboard');
    await page1.waitForURL('**/login', { timeout: 5000 });
    console.log('Protected route check passed: redirected from /dashboard back to /login.');

    // ==========================================
    // SEQUENCE 2: INSTANT MEETING SETUP
    // ==========================================
    console.log('Sequence 2: Meeting Ready Modal & Instant Meeting Setup starting...');

    // Log in userone1
    await clearAndType(page1, '#email', 'userone1234@example.com');
    await clearAndType(page1, '#password', 'userone1234');
    await page1.click('button[type="submit"]');
    await page1.waitForURL('**/dashboard', { timeout: 5000 });
    console.log('Logged in successfully as userone1. Landed on /dashboard.');

    // Click "New meeting" dropdown trigger
    await page1.click('.btn-new-meeting');
    console.log('Clicked "New meeting" dropdown.');

    // Click "Start an instant meeting" option
    // It's the button containing the text "Start an instant meeting"
    await page1.click('text=Start an instant meeting');
    console.log('Clicked "Start an instant meeting".');

    // Wait for the Lobby page
    await page1.waitForURL('**/lobby/**', { timeout: 10000 });
    console.log('Lobby page loaded for userone1.');

    // Click "Join now" in Lobby
    await page1.click('.google-join-now-btn');
    console.log('Clicked "Join now" in Lobby.');

    // Wait for Room page
    await page1.waitForURL('**/room/**', { timeout: 10000 });
    console.log('Room page loaded for userone1.');
    const roomUrl = page1.url();
    console.log(`Room URL: ${roomUrl}`);

    // Verify "Your meeting's ready" modal shows up
    await page1.waitForSelector('.google-meeting-ready-card', { timeout: 5000 });
    console.log('Verified "Your meeting\'s ready" modal is visible.');

    // Copy the meeting link from the input
    const linkInputVal = await page1.$eval('.shareable-link-input', el => el.value);
    console.log(`Link in ready modal: ${linkInputVal}`);

    // Close the ready modal
    await page1.click('.google-meeting-ready-close-btn');
    console.log('Closed the ready modal.');

    // ==========================================
    // SEQUENCE 3: MULTI-USER COLLABORATION & CONTROLS
    // ==========================================
    console.log('Sequence 3: Multi-User Collaboration & Controls starting...');

    // 1. Register and Log in usertwo2 on page2
    await page2.goto('http://localhost:5173/register');
    await page2.waitForLoadState('networkidle');
    await clearAndType(page2, '#username', 'usertwo2');
    await clearAndType(page2, '#email', 'usertwo1234@example.com');
    await clearAndType(page2, '#password', 'usertwo1234');
    await clearAndType(page2, '#confirmPassword', 'usertwo1234');
    await page2.click('input[type="checkbox"]');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('**/login', { timeout: 10000 });
    console.log('Registered usertwo2 successfully.');

    // Log in usertwo2
    await clearAndType(page2, '#email', 'usertwo1234@example.com');
    await clearAndType(page2, '#password', 'usertwo1234');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('**/dashboard', { timeout: 5000 });
    console.log('Logged in usertwo2 successfully.');

    // Navigate usertwo2 to the room URL
    await page2.goto(linkInputVal);
    await page2.waitForURL('**/lobby/**', { timeout: 10000 });
    console.log('Lobby page loaded for usertwo2.');

    // Click "Join now" in Lobby for usertwo2
    await page2.click('.google-join-now-btn');
    await page2.waitForURL('**/room/**', { timeout: 10000 });
    console.log('Room page loaded for usertwo2.');

    // Wait a brief moment to let WebRTC connections establish
    await page1.waitForTimeout(5000);
    console.log('WebRTC connection grace period elapsed.');

    // Verify both participants are visible in the room
    // Let's count video tiles or roster entries
    // On page 1:
    const page1RosterBtn = await page1.waitForSelector('button[title="Show everyone"]');
    await page1RosterBtn.click();
    await page1.waitForSelector('.google-sidebar-drawer');
    const participantNames1 = await page1.$$eval('.participant-item-name', el => el.map(e => e.innerText));
    console.log(`User One sees participants: ${participantNames1.join(', ')}`);
    if (participantNames1.length < 2) {
      throw new Error('Not all participants are showing in the roster of User One');
    }
    // Close sidebar
    await page1RosterBtn.click();

    // 2. Chat messaging test
    console.log('Testing chat drawer...');
    // Open chat on User 1
    await page1.click('button[title="Chat with everyone"]');
    await page1.waitForSelector('.google-sidebar-drawer');
    // Type and send message
    await page1.fill('.chat-input-field', 'Hello from User 1!');
    await page1.click('.chat-send-btn');
    console.log('User One sent chat message: "Hello from User 1!"');

    // Open chat on User 2 to verify and reply
    await page2.click('button[title="Chat with everyone"]');
    await page2.waitForSelector('.google-sidebar-drawer');
    
    // Verify message received on User 2
    const messageTexts = await page2.$$eval('.message-text', el => el.map(e => e.innerText));
    console.log(`User Two sees messages: ${messageTexts.join(', ')}`);
    if (!messageTexts.some(m => m.includes('Hello from User 1!'))) {
      throw new Error('User Two did not receive User One\'s chat message');
    }

    // Reply from User 2
    await page2.fill('.chat-input-field', 'Hi User 1!');
    await page2.click('.chat-send-btn');
    console.log('User Two sent chat message: "Hi User 1!"');

    // Verify reply received on User 1
    const messageTexts1 = await page1.$$eval('.message-text', el => el.map(e => e.innerText));
    console.log(`User One sees messages: ${messageTexts1.join(', ')}`);
    if (!messageTexts1.some(m => m.includes('Hi User 1!'))) {
      throw new Error('User One did not receive User Two\'s chat message');
    }

    // 3. Mute microphone status check
    console.log('Testing mic mute/unmute status...');
    // Currently User 1 is unmuted. Let's toggle mic in User 1.
    // The mic button has title "Turn off microphone (ctrl+d)"
    const micBtn1 = await page1.$('button[title="Turn off microphone (ctrl+d)"]');
    if (micBtn1) {
      await micBtn1.click();
      console.log('User One toggled microphone off.');
    } else {
      console.log('Could not find Turn off microphone button');
    }

    // Let's verify on User 2's end that User 1 is muted.
    // Wait for the mic icon change in User 2's room page
    // The VideoTile component shows: <span className="material-icons-round name-pill-mic-icon muted">mic_off</span> for muted users
    await page2.waitForSelector('.name-pill-mic-icon.muted', { timeout: 5000 });
    console.log('User Two successfully saw User One\'s muted mic icon.');

    // 4. Camera off avatar check
    console.log('Testing camera off fallback...');
    // Currently User 1 camera is on. Let's toggle camera off in User 1.
    const camBtn1 = await page1.$('button[title="Turn off camera (ctrl+e)"]');
    if (camBtn1) {
      await camBtn1.click();
      console.log('User One toggled camera off.');
    } else {
      console.log('Could not find Turn off camera button');
    }

    // Verify on User 2's end that User 1's avatar is shown.
    // The VideoTile shows: <div className="google-tile-avatar-fallback"> when camera is off
    await page2.waitForSelector('.google-tile-avatar-fallback', { timeout: 5000 });
    console.log('User Two successfully saw User One\'s avatar fallback.');

    // 5. Leave Call check
    console.log('Testing leave call propagation...');
    await page1.click('.google-leave-btn');
    await page1.click('.btn-leave-confirm');
    console.log('User One left the call.');

    // Verify User One is redirected to dashboard
    await page1.waitForURL('**/dashboard', { timeout: 5000 });
    console.log('User One redirected to /dashboard successfully.');

    // Verify User Two receives a leave toast notification or User One's tile disappears.
    // Let's wait for the toast: "left the call" or that the peer list only contains us
    await page2.waitForSelector('.google-toast-leave', { timeout: 5000 });
    console.log('User Two successfully received User One\'s leave notification toast.');

    console.log('All tests passed successfully!');
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
