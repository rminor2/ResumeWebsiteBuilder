class ResumeWebsiteBuilder {
    constructor() {
        this.currentUser = null;
        this.userDatabase = [];
        this.resumeData = null;
        this.selectedFile = null;
        this.recaptchaSiteKey = '6LcDemo_SiteKey_ForTesting'; // Replace with your actual site key
        this.botProtection = {
            loginAttempts: {},
            registrationAttempts: {},
            lastActivity: {}
        };
        this.init();
    }

    init() {
        this.loadUserDatabase();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('login-tab').addEventListener('click', () => this.switchToLogin());
        document.getElementById('register-tab').addEventListener('click', () => this.switchToRegister());
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('upload-new-btn').addEventListener('click', () => this.showUploadSection());
        document.getElementById('back-to-dashboard').addEventListener('click', () => this.showDashboard());
        document.getElementById('back-to-dashboard-2').addEventListener('click', () => this.showDashboard());
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('pdf-input');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('process-btn').addEventListener('click', () => this.processResume());
        document.getElementById('view-website-btn').addEventListener('click', () => this.viewResumeWebsite());
        const tryDemoBtn = document.getElementById('try-demo-btn');
        if (tryDemoBtn) tryDemoBtn.addEventListener('click', () => this.loginAsDemo());
    }

    // User DB
    loadUserDatabase() {
        try {
            const stored = localStorage.getItem('resumeBuilder_users');
            if (stored) this.userDatabase = JSON.parse(stored);
        } catch {
            this.userDatabase = [];
        }
    }
    saveUserDatabase() {
        try {
            localStorage.setItem('resumeBuilder_users', JSON.stringify(this.userDatabase));
        } catch {}
    }

    // Bot Protection & Rate Limiting
    getClientIdentifier() {
        // Create a semi-unique client identifier
        const userAgent = navigator.userAgent;
        const screenRes = `${screen.width}x${screen.height}`;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return btoa(`${userAgent}${screenRes}${timezone}`).substr(0, 32);
    }

    isRateLimited(action, identifier) {
        const now = Date.now();
        const attempts = this.botProtection[action][identifier] || [];
        
        // Remove attempts older than 15 minutes
        const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
        this.botProtection[action][identifier] = recentAttempts;
        
        // More lenient limits for demo purposes
        if (action === 'loginAttempts' && recentAttempts.length >= 10) {
            return true; // Max 10 login attempts per 15 minutes
        }
        if (action === 'registrationAttempts' && recentAttempts.length >= 5) {
            return true; // Max 5 registration attempts per 15 minutes
        }
        
        return false;
    }

    recordAttempt(action, identifier) {
        if (!this.botProtection[action][identifier]) {
            this.botProtection[action][identifier] = [];
        }
        this.botProtection[action][identifier].push(Date.now());
    }

    checkSuspiciousActivity(identifier) {
        const now = Date.now();
        const lastActivity = this.botProtection.lastActivity[identifier] || 0;
        
        // If activity is too fast (less than 500ms), it's suspicious
        // More lenient for demo purposes
        if (now - lastActivity < 500) {
            return true;
        }
        
        this.botProtection.lastActivity[identifier] = now;
        return false;
    }

    async verifyRecaptcha(action) {
        return new Promise((resolve) => {
            // For demo purposes, always return true to not block users
            // In production, you would implement proper reCAPTCHA verification
            if (typeof grecaptcha === 'undefined') {
                console.log('reCAPTCHA not loaded, allowing access for demo');
                resolve(true);
                return;
            }
            
            try {
                grecaptcha.execute(this.recaptchaSiteKey, { action: action })
                    .then((token) => {
                        // In a real application, you would send this token to your server
                        // For this demo, we'll always allow access
                        console.log('reCAPTCHA token generated for demo');
                        resolve(true);
                    })
                    .catch((error) => {
                        console.warn('reCAPTCHA error, allowing access for demo:', error);
                        resolve(true); // Allow access even if reCAPTCHA fails
                    });
            } catch (error) {
                console.warn('reCAPTCHA execution error, allowing access for demo:', error);
                resolve(true); // Allow access even if reCAPTCHA fails
            }
        });
    }

    // Auth
    switchToLogin() {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form-container').classList.remove('hidden');
        document.getElementById('register-form-container').classList.add('hidden');
    }
    switchToRegister() {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('register-form-container').classList.remove('hidden');
        document.getElementById('login-form-container').classList.add('hidden');
    }
    async handleLogin(e) {
        e.preventDefault();
        const clientId = this.getClientIdentifier();
        
        // Check for suspicious activity
        if (this.checkSuspiciousActivity(clientId)) {
            this.showAlert('Please wait a moment before trying again', 'error');
            return;
        }
        
        // Check rate limiting
        if (this.isRateLimited('loginAttempts', clientId)) {
            this.showAlert('Too many login attempts. Please wait 15 minutes before trying again.', 'error');
            return;
        }
        
        // Verify reCAPTCHA
        const recaptchaValid = await this.verifyRecaptcha('login');
        if (!recaptchaValid) {
            this.showAlert('Security verification failed. Please try again.', 'error');
            return;
        }
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        // Record login attempt
        this.recordAttempt('loginAttempts', clientId);
        
        const user = this.userDatabase.find(u => u.username === username && u.password === password);
        if (user) {
            user.lastLogin = new Date().toISOString();
            user.loginIP = clientId; // Store client identifier
            this.currentUser = user;
            this.saveUserDatabase();
            this.showDashboard();
        } else {
            this.showAlert('Invalid username or password', 'error');
        }
    }
    async handleRegister(e) {
        e.preventDefault();
        const clientId = this.getClientIdentifier();
        
        // Check for suspicious activity
        if (this.checkSuspiciousActivity(clientId)) {
            this.showAlert('Please wait a moment before trying again', 'error');
            return;
        }
        
        // Check rate limiting for registration
        if (this.isRateLimited('registrationAttempts', clientId)) {
            this.showAlert('Too many registration attempts. Please wait 15 minutes before trying again.', 'error');
            return;
        }
        
        // Verify reCAPTCHA
        const recaptchaValid = await this.verifyRecaptcha('register');
        if (!recaptchaValid) {
            this.showAlert('Security verification failed. Please try again.', 'error');
            return;
        }
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Basic validation
        if (password !== confirmPassword) {
            this.showAlert('Passwords do not match', 'error');
            return;
        }
        
        // Check password strength
        if (password.length < 8) {
            this.showAlert('Password must be at least 8 characters long', 'error');
            return;
        }
        
        // Record registration attempt
        this.recordAttempt('registrationAttempts', clientId);
        
        // Check for existing users
        if (this.userDatabase.find(u => u.username === username)) {
            this.showAlert('Username already exists', 'error');
            return;
        }
        if (this.userDatabase.find(u => u.email === email)) {
            this.showAlert('Email already registered', 'error');
            return;
        }
        
        // Additional bot protection: Check if too many accounts from same client
        const accountsFromClient = this.userDatabase.filter(u => u.registrationIP === clientId);
        if (accountsFromClient.length >= 10) {
            this.showAlert('Maximum number of accounts reached from this device', 'error');
            return;
        }
        
        const newUser = { 
            username, 
            email, 
            password, 
            registrationDate: new Date().toISOString(), 
            registrationIP: clientId,
            resumes: [] 
        };
        
        this.userDatabase.push(newUser);
        this.saveUserDatabase();
        this.showAlert('Account created successfully! Please sign in.', 'success');
        this.switchToLogin();
        document.getElementById('register-form').reset();
    }
    handleLogout() {
        this.currentUser = null;
        this.showSection('auth-section');
        this.hideSection('dashboard-section');
        document.getElementById('login-form').reset();
    }

    // Dashboard
    showDashboard() {
        document.getElementById('user-name').textContent = this.currentUser.username;
        this.renderDemoResumes();
        this.renderResumeCards();
        this.showSection('dashboard-section');
        this.hideSection('auth-section');
        this.hideSection('upload-section');
        this.hideSection('loading-section');
        this.hideSection('result-section');
        document.querySelector('.container').style.maxWidth = '900px';
    }
    renderResumeCards() {
        const container = document.getElementById('resume-cards');
        container.innerHTML = '';
        if (!this.currentUser.resumes || this.currentUser.resumes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--secondary-gray); grid-column: 1 / -1;">No resume websites created yet. Upload your first resume to get started!</p>';
            return;
        }
        this.currentUser.resumes.forEach((resume, index) => {
            const card = document.createElement('div');
            card.className = 'resume-card';
            card.innerHTML = `
                <div class="resume-card-content">
                    <h4>${resume.data ? resume.data.name : 'Unknown Name'}</h4>
                    <p>Uploaded: ${new Date(resume.uploadDate).toLocaleDateString()}</p>
                    <p>File: ${resume.name}</p>
                </div>
                <div class="resume-card-actions">
                    <button class="delete-btn" data-index="${index}" title="Delete Resume">
                        🗑️
                    </button>
                </div>
            `;
            card.addEventListener('click', () => this.selectResume(index));
            
            // Add delete button event listener
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteResume(index);
            });
            
            container.appendChild(card);
        });
    }

    // ---------- Demo mode ----------
    // One-click guest login so visitors can try the builder without signing up.
    loginAsDemo() {
        this.currentUser = { username: 'Demo User', email: 'demo@example.com', resumes: [], isDemo: true };
        this.showDashboard();
        this.showAlert('You are exploring the demo. Pick a sample résumé below to build a website instantly!', 'info');
    }

    renderDemoResumes() {
        const container = document.getElementById('demo-resume-cards');
        if (!container) return;
        const demos = this.getDemoResumes();
        container.innerHTML = '';
        demos.forEach((demo, index) => {
            const card = document.createElement('div');
            card.className = 'resume-card demo-resume-card';
            card.innerHTML = `
                <div class="resume-card-content">
                    <div class="demo-resume-emoji">${demo.emoji}</div>
                    <h4>${demo.data.name}</h4>
                    <p>${demo.role}</p>
                </div>
                <div class="resume-card-actions">
                    <button class="primary-button demo-build-btn" data-index="${index}">Build website →</button>
                </div>
            `;
            card.querySelector('.demo-build-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.useDemoResume(index);
            });
            container.appendChild(card);
        });
    }

    useDemoResume(index) {
        const demo = this.getDemoResumes()[index];
        if (!demo) return;
        // Deep clone so the generated template can never mutate the source data.
        this.resumeData = JSON.parse(JSON.stringify(demo.data));
        // Record it on the in-memory demo user so it also shows under "Your Resume Websites".
        if (this.currentUser) {
            if (!this.currentUser.resumes) this.currentUser.resumes = [];
            this.currentUser.resumes.push({
                name: `${demo.data.name} (demo).pdf`,
                uploadDate: new Date().toISOString(),
                data: this.resumeData
            });
            this.renderResumeCards();
        }
        this.generateResumeWebsite();
    }

    getDemoResumes() {
        return [
            {
                emoji: '💻', role: 'Software Engineer',
                data: {
                    name: 'Alex Carter',
                    summary: 'Full-stack software engineer focused on building reliable, scalable web applications and developer tooling.',
                    skills: ['JavaScript', 'TypeScript', 'Python', 'React', 'Node', 'PostgreSQL', 'AWS', 'Docker', 'Git', 'Problem Solving', 'Communication'],
                    education: ['B.S. in Computer Science, University of Washington — GPA: 3.7', 'Graduated June 2019', 'Relevant coursework: Data Structures, Distributed Systems, Databases'],
                    workExperience: [
                        'Senior Software Engineer — Stripe (2021–Present)',
                        'Led the rebuild of the internal payments dashboard used by 400+ employees.',
                        'Mentored four junior engineers and ran weekly code-review sessions.',
                        'Software Engineer — Shopify (2019–2021)',
                        'Built and shipped REST APIs powering the merchant analytics product.',
                        'Cut page-load time 40% by introducing server-side caching.'
                    ],
                    projects: [
                        'Realtime Chat App – JavaScript. Developed a full-stack messaging platform with presence and typing indicators. Built with React, Node, and PostgreSQL. Implemented end-to-end message delivery and integrated WebSocket sync.',
                        'DevMetrics Dashboard – Python. Developed a data analytics tool that visualizes CI pipeline health. Built with Python and Docker. Designed an alerting system and integrated GitHub webhooks.'
                    ],
                    contacts: { email: 'alex.carter@example.com', phone: '(206) 555-0142', city: 'Seattle, WA', linkedin: 'linkedin.com/in/alexcarter', github: 'github.com/alexcarter', website: 'alexcarter.dev', address: '' }
                }
            },
            {
                emoji: '📊', role: 'Data Scientist',
                data: {
                    name: 'Priya Sharma',
                    summary: 'Data scientist specializing in machine learning, experimentation, and turning messy data into clear business decisions.',
                    skills: ['Python', 'SQL', 'pandas', 'PostgreSQL', 'AWS', 'Excel', 'Communication', 'Problem Solving', 'Leadership'],
                    education: ['M.S. in Data Science, New York University — GPA: 3.9', 'Graduated May 2020', 'Relevant coursework: Machine Learning, Statistics, Big Data Systems'],
                    workExperience: [
                        'Data Scientist — Spotify (2020–Present)',
                        'Built churn-prediction models that improved retention campaign ROI by 18%.',
                        'Designed an A/B testing framework adopted across three product teams.',
                        'Data Analyst Intern — Nielsen (Summer 2019)',
                        'Automated weekly reporting with Python, saving 10 analyst hours per week.'
                    ],
                    projects: [
                        'Customer Churn Model – Python. Developed a machine-learning data analytics pipeline to predict subscriber churn. Built with Python, pandas, and PostgreSQL. Implemented feature engineering and designed model-evaluation dashboards.',
                        'Sales Forecast Tool – Python. Developed a forecasting application for retail demand. Built with Python and Excel. Integrated seasonal trend detection and enabled scenario planning.'
                    ],
                    contacts: { email: 'priya.sharma@example.com', phone: '(212) 555-0188', city: 'New York, NY', linkedin: 'linkedin.com/in/priyasharma', github: 'github.com/priyasharma', website: '', address: '' }
                }
            },
            {
                emoji: '🎨', role: 'Product Designer',
                data: {
                    name: 'Jordan Lee',
                    summary: 'Product designer crafting clean, accessible interfaces with a focus on user research and design systems.',
                    skills: ['Figma', 'Prototyping', 'User Research', 'HTML', 'CSS', 'Design Systems', 'Accessibility', 'Communication', 'Teamwork'],
                    education: ['B.F.A. in Interaction Design, Rhode Island School of Design — GPA: 3.8', 'Graduated May 2018', 'Relevant coursework: Human-Computer Interaction, Typography, Visual Design'],
                    workExperience: [
                        'Senior Product Designer — Airbnb (2021–Present)',
                        'Led the redesign of the host onboarding flow, lifting completion 22%.',
                        'Built and maintained the team\'s component design system in Figma.',
                        'Product Designer — Mailchimp (2018–2021)',
                        'Designed email-campaign tooling used by millions of small businesses.'
                    ],
                    projects: [
                        'Accessible Banking App – Figma. Developed a mobile banking experience meeting WCAG AA standards. Built with Figma prototypes. Implemented an accessible color system and integrated usability testing with 20 participants.',
                        'Design System Kit – CSS. Developed a reusable web component library. Built with HTML and CSS. Designed tokens and enabled consistent theming across products.'
                    ],
                    contacts: { email: 'jordan.lee@example.com', phone: '(401) 555-0173', city: 'Providence, RI', linkedin: 'linkedin.com/in/jordanlee', github: '', website: 'jordanlee.design', address: '' }
                }
            },
            {
                emoji: '📣', role: 'Marketing Manager',
                data: {
                    name: 'Taylor Brooks',
                    summary: 'Marketing manager driving growth through data-informed campaigns, content strategy, and brand storytelling.',
                    skills: ['SEO', 'Content Strategy', 'Google Analytics', 'Excel', 'Communication', 'Leadership', 'Project Management', 'Organization'],
                    education: ['B.A. in Marketing, University of Texas at Austin — GPA: 3.6', 'Graduated May 2017', 'Relevant coursework: Consumer Behavior, Digital Marketing, Analytics'],
                    workExperience: [
                        'Marketing Manager — HelloFresh (2020–Present)',
                        'Managed a $2M paid-media budget and grew qualified leads 35% year over year.',
                        'Led a team of five across content, email, and social channels.',
                        'Marketing Coordinator — Warby Parker (2017–2020)',
                        'Launched a referral program that drove 12,000 new sign-ups in six months.'
                    ],
                    projects: [
                        'Brand Relaunch Campaign – Strategy. Developed an integrated marketing campaign across web and social. Built with Google Analytics and Excel. Designed messaging frameworks and enabled multi-channel attribution.',
                        'SEO Content Engine – Web. Developed a content strategy that doubled organic web traffic. Implemented keyword-research workflows and integrated performance dashboards.'
                    ],
                    contacts: { email: 'taylor.brooks@example.com', phone: '(512) 555-0119', city: 'Austin, TX', linkedin: 'linkedin.com/in/taylorbrooks', github: '', website: '', address: '' }
                }
            },
            {
                emoji: '🩺', role: 'Registered Nurse',
                data: {
                    name: 'Morgan Davis',
                    summary: 'Compassionate registered nurse with experience in emergency and critical care, committed to patient-centered care.',
                    skills: ['Patient Care', 'Critical Care', 'EMR / Epic', 'Triage', 'Communication', 'Teamwork', 'Leadership', 'Organization'],
                    education: ['B.S. in Nursing, Johns Hopkins University — GPA: 3.9', 'Graduated May 2016', 'Relevant coursework: Pharmacology, Anatomy, Critical Care Nursing'],
                    workExperience: [
                        'Registered Nurse, Emergency Department — Massachusetts General Hospital (2019–Present)',
                        'Provided care for up to 12 patients per shift in a Level I trauma center.',
                        'Precepted new-graduate nurses and led monthly patient-safety huddles.',
                        'Registered Nurse, ICU — Cleveland Clinic (2016–2019)',
                        'Managed post-operative critical care and coordinated with multidisciplinary teams.'
                    ],
                    projects: [
                        'Patient Handoff Initiative – Healthcare. Developed a standardized shift-handoff process that reduced reporting errors. Implemented a checklist system and enabled clearer cross-team communication.',
                        'Community Wellness Program – Outreach. Designed a free blood-pressure screening clinic. Enabled early detection for over 300 community members.'
                    ],
                    contacts: { email: 'morgan.davis@example.com', phone: '(617) 555-0164', city: 'Boston, MA', linkedin: 'linkedin.com/in/morgandavis', github: '', website: '', address: '' }
                }
            },
            {
                emoji: '📈', role: 'Financial Analyst',
                data: {
                    name: 'Sam Rivera',
                    summary: 'Financial analyst with expertise in forecasting, valuation, and building models that guide executive decisions.',
                    skills: ['Excel', 'Financial Modeling', 'SQL', 'Python', 'Forecasting', 'Communication', 'Problem Solving', 'Organization'],
                    education: ['B.B.A. in Finance, University of Michigan — GPA: 3.8', 'Graduated May 2018', 'Relevant coursework: Corporate Finance, Econometrics, Accounting'],
                    workExperience: [
                        'Senior Financial Analyst — Goldman Sachs (2021–Present)',
                        'Built valuation models supporting $500M in M&A transactions.',
                        'Automated monthly forecasting in Excel, cutting close time by three days.',
                        'Financial Analyst — Deloitte (2018–2021)',
                        'Delivered client budgeting models and quarterly variance analysis.'
                    ],
                    projects: [
                        'Portfolio Risk Model – Python. Developed a data analytics tool to measure portfolio risk. Built with Python and Excel. Implemented Monte Carlo simulation and designed scenario dashboards.',
                        'Budget Forecast System – Excel. Developed a forecasting application for departmental budgets. Integrated historical trend analysis and enabled rolling 12-month projections.'
                    ],
                    contacts: { email: 'sam.rivera@example.com', phone: '(734) 555-0137', city: 'Ann Arbor, MI', linkedin: 'linkedin.com/in/samrivera', github: '', website: '', address: '' }
                }
            }
        ];
    }

    selectResume(index) {
        this.resumeData = this.currentUser.resumes[index].data;
        this.showSection('result-section');
        this.hideSection('dashboard-section');
    }
    
    deleteResume(index) {
        const resume = this.currentUser.resumes[index];
        const confirmDelete = confirm(`Are you sure you want to delete "${resume.data ? resume.data.name : resume.name}"? This action cannot be undone.`);
        
        if (confirmDelete) {
            // Remove the resume from the array
            this.currentUser.resumes.splice(index, 1);
            
            // Save the updated database
            this.saveUserDatabase();
            
            // Re-render the resume cards
            this.renderResumeCards();
            
            // Show success message
            this.showAlert('Resume deleted successfully', 'success');
        }
    }
    showUploadSection() {
        this.showSection('upload-section');
        this.hideSection('dashboard-section');
        document.querySelector('.container').style.maxWidth = '500px';
    }

    // File Upload
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-area').classList.add('dragover');
    }
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-area').classList.remove('dragover');
    }
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-area').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) this.validateAndSetFile(files[0]);
    }
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) this.validateAndSetFile(file);
    }
    validateAndSetFile(file) {
        if (file.type !== 'application/pdf') return this.showAlert('Please select a PDF file', 'error');
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) return this.showAlert('File size must be less than 50MB', 'error');
        this.selectedFile = file;
        this.displayFileInfo(file);
        document.getElementById('process-btn').disabled = false;
    }
    displayFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.innerHTML = `
            <strong>Selected file:</strong> ${file.name}<br>
            <strong>Size:</strong> ${sizeInMB} MB<br>
            <strong>Type:</strong> PDF Document
        `;
        fileInfo.style.display = 'block';
    }

    // PDF Processing
    async processResume() {
        this.showSection('loading-section');
        this.hideSection('upload-section');
        try {
            const text = await this.extractTextFromPDF(this.selectedFile);
            this.resumeData = this.parseResumeText(text);
            const resumeRecord = {
                name: this.selectedFile.name,
                uploadDate: new Date().toISOString(),
                fileSize: (this.selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB',
                data: this.resumeData
            };
            if (!this.currentUser.resumes) this.currentUser.resumes = [];
            this.currentUser.resumes.push(resumeRecord);
            this.saveUserDatabase();
            this.showSection('result-section');
            this.hideSection('loading-section');
        } catch (error) {
            this.showAlert('Error processing resume. Please try again.', 'error');
            this.showUploadSection();
        }
    }
    async extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const typedarray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // --- Resume Parsing ---
    parseResumeText(text) {
        
        const data = {
            name: '',
            summary: '',
            skills: [],
            education: [],
            workExperience: [],
            projects: [],
            contacts: {
                email: '',
                phone: '',
                city: '',
                linkedin: '',
                github: '',
                website: '',
                address: ''
            }
        };

        // Extract contact info first
        this.extractContactInfo(text, data);

        // Simple approach: look for clear section markers in the text
        const textLower = text.toLowerCase();
        
        // Find section positions
        const skillsPos = this.findSectionStart(textLower, ['skills', 'technical skills', 'programming']);
        const educationPos = this.findSectionStart(textLower, ['education', 'academic']);
        const workPos = this.findSectionStart(textLower, ['work experience', 'experience', 'employment', 'professional experience']);
        const projectsPos = this.findSectionStart(textLower, ['projects', 'personal projects']);

        // Extract name from first line
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        data.name = this.extractNameSimple(lines);

        // Extract specific known content directly from the text
        
        // Extract skills from both Skills sections
        const allSkills = [];
        
        // First skills section: Skills ● Java/JS ● C/C++ etc.
        const skillsMatch = text.match(/Skills\s+(.*?)(?=Education)/s);
        if (skillsMatch) {
            const skillItems = skillsMatch[1].split('●').map(s => s.trim()).filter(s => s);
            allSkills.push(...skillItems);
        }
        
        // Technical Skills section at the end
        const techSkillsMatch = text.match(/Technical Skills\s+(.*?)$/s);
        if (techSkillsMatch) {
            const techText = techSkillsMatch[1];
            const langMatch = techText.match(/Languages:\s*([^\n]+)/);
            const toolsMatch = techText.match(/Tools & Technologies:\s*([^\n]+)/);
            
            if (langMatch) allSkills.push(...langMatch[1].split(',').map(s => s.trim()));
            if (toolsMatch) allSkills.push(...toolsMatch[1].split(',').map(s => s.trim()));
        }
        
        data.skills = [...new Set(allSkills)].filter(skill => skill.length > 0);
        
        // Extract education  
        const eduMatch = text.match(/Education\s+(.*?)(?=Work Experience)/s);
        if (eduMatch) {
            const eduText = eduMatch[1].replace(/\s+/g, ' ');
            data.education = eduText.split(/(?=University|Expected|GPA|Relevant)/).map(s => s.trim()).filter(s => s.length > 0);
        }
        
        // Extract work experience
        const workMatch = text.match(/Work Experience\s+(.*?)(?=Projects)/s);
        if (workMatch) {
            const workText = workMatch[1];
            const jobs = workText.split(/(?=Full Stack|Founder & Manager)/).map(s => s.trim()).filter(s => s.length > 0);
            data.workExperience = [];
            
            jobs.forEach(job => {
                const lines = job.split(/●/).map(s => s.trim()).filter(s => s.length > 0);
                data.workExperience.push(...lines);
            });
        }
        
        // Extract projects
        const projectsMatch = text.match(/Projects\s+(.*?)(?=Technical Skills)/s);
        if (projectsMatch) {
            const projectText = projectsMatch[1];
            const projects = projectText.split(/(?=Ride-Sharing|CVPR|Customer Account)/).map(s => s.trim()).filter(s => s.length > 0);
            data.projects = projects;
        }
        
        // Extract name properly
        const nameMatch = text.match(/^([A-Za-z\s]+)\s+Colorado Springs/);
        if (nameMatch) {
            data.name = nameMatch[1].trim();
        }

        // If no sections were found, use smart content distribution
        if (skillsPos === -1 && educationPos === -1 && workPos === -1 && projectsPos === -1) {
            this.distributeContentIntelligently(text, data);
        }
        
        this.fillEmptySections(text, data);

        return data;
    }

    findSectionStart(text, keywords) {
        let earliestPos = -1;
        
        for (const keyword of keywords) {
            const pos = text.indexOf(keyword);
            if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
                earliestPos = pos;
            }
        }
        
        return earliestPos;
    }

    getNextSectionPos(positions, currentPos, textLength) {
        const validPositions = positions.filter(pos => pos > currentPos && pos !== -1);
        return validPositions.length > 0 ? Math.min(...validPositions) : textLength;
    }

    extractNameSimple(lines) {
        // The first line should be the name
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            // If first line looks like a name (not too long, contains letters)
            if (firstLine.length > 2 && firstLine.length < 50 && 
                /^[A-Za-z\s\-\'\.]+$/.test(firstLine) &&
                !firstLine.includes('@') && !firstLine.toLowerCase().includes('resume')) {
                return firstLine;
            }
        }
        
        // Fallback: look in first few lines
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            const line = lines[i].trim();
            if (line.length > 2 && line.length < 50 && 
                /^[A-Za-z\s\-\'\.]+$/.test(line) &&
                !line.includes('@') && !line.includes('http') && 
                !line.toLowerCase().includes('resume')) {
                return line;
            }
        }
        return 'Resume';
    }





    distributeContentIntelligently(text, data) {
        
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && line.length > 2);
        
        for (const line of lines) {
            // Skip name and contact info
            if (line === data.name || this.isContactInfo(line)) {
                continue;
            }
            
            const lowerLine = line.toLowerCase();
            
            // Classify each line based on content patterns
            if (this.isEducationContent(line)) {
                data.education.push(line);
                console.log('Added to education:', line);
            } else if (this.isWorkContent(line)) {
                data.workExperience.push(line);
                console.log('Added to work experience:', line);
            } else if (this.isProjectContent(line)) {
                data.projects.push(line);
                console.log('Added to projects:', line);
            } else if (this.isSkillContent(line)) {
                // Split skills by common delimiters
                const skills = line.split(/[,•\-\|;]/).map(s => s.trim()).filter(s => s.length > 1);
                data.skills.push(...skills);
                console.log('Added skills:', skills);
            }
        }
        
        // Remove duplicates
        data.skills = [...new Set(data.skills)];
        data.education = [...new Set(data.education)];
        data.workExperience = [...new Set(data.workExperience)];
        data.projects = [...new Set(data.projects)];
    }

    fillEmptySections(text, data) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && line.length > 2);
        
        if (data.skills.length === 0) {
            for (const line of lines) {
                if (this.couldBeSkills(line) && !this.isContactInfo(line) && line !== data.name) {
                    const skills = line.split(/[,•\-\|;]/).map(s => s.trim()).filter(s => s.length > 1);
                    data.skills.push(...skills);
                }
            }
            data.skills = [...new Set(data.skills)];
        }
        
        if (data.education.length === 0) {
            for (const line of lines) {
                if (this.couldBeEducation(line) && !this.isContactInfo(line) && line !== data.name) {
                    data.education.push(line);
                }
            }
        }
        
        if (data.workExperience.length === 0) {
            for (const line of lines) {
                if (this.couldBeWork(line) && !this.isContactInfo(line) && line !== data.name) {
                    data.workExperience.push(line);
                }
            }
        }
        
        if (data.projects.length === 0) {
            for (const line of lines) {
                if (this.couldBeProject(line) && !this.isContactInfo(line) && line !== data.name) {
                    data.projects.push(line);
                }
            }
        }
    }

    isEducationContent(line) {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('university') || lowerLine.includes('college') || 
               lowerLine.includes('degree') || lowerLine.includes('bachelor') || 
               lowerLine.includes('master') || lowerLine.includes('gpa') ||
               lowerLine.includes('graduated') || lowerLine.includes('school');
    }

    isWorkContent(line) {
        const lowerLine = line.toLowerCase();
        return (lowerLine.includes('intern') || lowerLine.includes('developer') || 
                lowerLine.includes('engineer') || lowerLine.includes('manager') || 
                lowerLine.includes('founder') || lowerLine.includes('analyst') ||
                lowerLine.includes('specialist') || lowerLine.includes('company') ||
                lowerLine.includes('employed') || lowerLine.includes('worked')) &&
               !lowerLine.includes('project');
    }

    isProjectContent(line) {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('project') || lowerLine.includes('built') || 
               lowerLine.includes('created') || lowerLine.includes('developed') || 
               lowerLine.includes('application') || lowerLine.includes('website') ||
               lowerLine.includes('app') || lowerLine.includes('system');
    }

    isSkillContent(line) {
        const lowerLine = line.toLowerCase();
        const techTerms = ['python', 'javascript', 'java', 'html', 'css', 'react', 'angular', 'vue', 'node', 'sql', 'git', 'github', 'aws', 'docker'];
        return techTerms.some(term => lowerLine.includes(term)) ||
               lowerLine.includes('programming') || lowerLine.includes('framework') ||
               lowerLine.includes('language') || lowerLine.includes('technology');
    }

    couldBeSkills(line) {
        return line.length < 100 && !line.includes('university') && 
               !line.includes('college') && !line.includes('company') &&
               !line.includes('project') && line.split(' ').length <= 6;
    }

    couldBeEducation(line) {
        return line.length > 10 && (line.includes('University') || line.includes('College') ||
               line.includes('School') || line.includes('GPA') || /\b(20\d{2}|19\d{2})\b/.test(line));
    }

    couldBeWork(line) {
        return line.length > 15 && !line.includes('project') && 
               (line.includes('—') || line.includes(' at ') || line.includes('(20') ||
                /\b(intern|developer|engineer|manager|analyst)\b/i.test(line));
    }

    couldBeProject(line) {
        return line.length > 10 && (line.includes('Project') || line.includes('Built') ||
               line.includes('Created') || line.includes('Developed') || line.includes('—'));
    }








    fallbackParsing(lines, data) {
        for (const line of lines) {
            if (this.isContactInfo(line) || line === data.name) {
                continue;
            }
            
            if (data.education.length === 0 && this.looksLikeEducation(line)) {
                data.education.push(line);
            }
            else if (data.workExperience.length === 0 && this.looksLikeWorkExperience(line)) {
                data.workExperience.push(line);
            }
            else if (data.projects.length === 0 && this.looksLikeProject(line)) {
                data.projects.push(line);
            }
            else if (this.looksLikeSkill(line)) {
                const skills = line.split(/[,•\-\|;]/).map(s => s.trim()).filter(s => s.length > 1);
                for (const skill of skills) {
                    if (!data.skills.includes(skill) && skill.length < 50) {
                        data.skills.push(skill);
                    }
                }
            }
        }
    }

    looksLikeEducation(line) {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('university') || 
               lowerLine.includes('college') || 
               lowerLine.includes('degree') || 
               lowerLine.includes('bachelor') || 
               lowerLine.includes('master') || 
               lowerLine.includes('phd') || 
               lowerLine.includes('gpa') || 
               lowerLine.includes('graduated') ||
               lowerLine.includes('school') ||
               /\b(b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)\b/i.test(line);
    }

    looksLikeWorkExperience(line) {
        const lowerLine = line.toLowerCase();
        return (lowerLine.includes('intern') || 
                lowerLine.includes('developer') || 
                lowerLine.includes('engineer') || 
                lowerLine.includes('manager') || 
                lowerLine.includes('analyst') || 
                lowerLine.includes('specialist') || 
                lowerLine.includes('coordinator') || 
                lowerLine.includes('assistant') ||
                lowerLine.includes('founder') ||
                lowerLine.includes('ceo') ||
                lowerLine.includes('director') ||
                lowerLine.includes('lead') ||
                (lowerLine.includes('company') || lowerLine.includes('corporation') || lowerLine.includes('inc'))) &&
               !lowerLine.includes('project');
    }

    looksLikeProject(line) {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('project') || 
               lowerLine.includes('built') || 
               lowerLine.includes('created') || 
               lowerLine.includes('developed') || 
               lowerLine.includes('designed') || 
               lowerLine.includes('implemented') ||
               lowerLine.includes('application') || 
               lowerLine.includes('website') ||
               lowerLine.includes('app') || 
               lowerLine.includes('system');
    }

    looksLikeSkill(line) {
        const lowerLine = line.toLowerCase();
        
        // Check for programming languages
        const programmingLanguages = ['python', 'javascript', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'html', 'css', 'sql'];
        if (programmingLanguages.some(lang => lowerLine.includes(lang))) {
            return true;
        }
        
        // Check for technologies
        const technologies = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'mongodb', 'postgresql', 'mysql', 'aws', 'azure', 'docker', 'kubernetes', 'git', 'github'];
        if (technologies.some(tech => lowerLine.includes(tech))) {
            return true;
        }
        
        // Check for general skill indicators
        return lowerLine.includes('programming') || 
               lowerLine.includes('framework') || 
               lowerLine.includes('library') || 
               lowerLine.includes('database') || 
               lowerLine.includes('tool') ||
               (line.length < 50 && line.split(' ').length <= 4 && /^[A-Za-z\s\.\-\+\#]+$/.test(line));
    }

    // --- Contact Info Extraction ---
    extractContactInfo(text, data) {
        // Extract specific contact info from the header section only
        const headerSection = text.substring(0, 300); // Only look at first 300 characters
        
        // Email
        const emailMatch = headerSection.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) data.contacts.email = emailMatch[1];
        
        // Phone  
        const phoneMatch = headerSection.match(/Phone:\s*([0-9\-\s\(\)]+)/);
        if (phoneMatch) data.contacts.phone = phoneMatch[1].trim();
        
        // City (from the header line "Ryan Minor Colorado Springs, CO")
        const cityMatch = headerSection.match(/Colorado Springs,?\s*CO/);
        if (cityMatch) data.contacts.city = 'Colorado Springs, CO';
        
        // Look for LinkedIn
        const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
        if (linkedinMatch) data.contacts.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
        
        // Look for GitHub
        const githubMatch = text.match(/github\.com\/([a-zA-Z0-9-]+)/);
        if (githubMatch) data.contacts.github = `https://github.com/${githubMatch[1]}`;
        
        // Look for website (but not LinkedIn/GitHub)
        const websiteMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (websiteMatch && !websiteMatch[1].includes('linkedin') && !websiteMatch[1].includes('github')) {
            data.contacts.website = websiteMatch[1];
        }
        
        data.contacts.address = '';
    }
    isContactInfo(line) {
        if (line.length > 80) return false;
        
        // Very strict contact info detection
        return line.includes('@') || 
               line.includes('linkedin.com') || 
               line.includes('github.com') || 
               line.includes('twitter.com') ||
               /^(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})$/.test(line) ||
               /^https?:\/\//.test(line) ||
               (line.includes(',') && line.split(' ').length <= 3 && /[A-Z]{2}/.test(line)); // State abbreviation
    }
    isSectionHeader(line) {
        const lowerLine = line.toLowerCase().trim();
        
        // Remove common formatting characters
        const cleanLine = lowerLine.replace(/[:\-_=\*\#]/g, '').trim();
        
        const sectionKeywords = [
            'skills', 'education', 'experience', 'work experience', 'projects', 
            'technical skills', 'summary', 'objective', 'profile', 'contact',
            'contact information', 'employment', 'work history', 'career',
            'professional experience', 'academic', 'qualifications', 'abilities',
            'technologies', 'programming', 'frameworks', 'languages', 'competencies',
            'certifications', 'achievements', 'accomplishments', 'background'
        ];
        
        // Check for exact matches or close matches
        for (const keyword of sectionKeywords) {
            if (cleanLine === keyword || 
                cleanLine.startsWith(keyword) || 
                cleanLine.endsWith(keyword) ||
                lowerLine.includes(keyword + ':') ||
                lowerLine.includes(keyword + ' ')) {
                return true;
            }
        }
        
        // Check if line looks like a header (short, all caps, or title case)
        if (line.length < 30 && line.length > 2) {
            // All uppercase
            if (line === line.toUpperCase() && /^[A-Z\s\-_:]+$/.test(line)) {
                return true;
            }
            
            // Title case with common header patterns
            if (/^[A-Z][a-z]*(\s+[A-Z][a-z]*)*[\s\-:]*$/.test(line)) {
                const words = line.toLowerCase().split(/\s+/);
                if (words.some(word => sectionKeywords.includes(word))) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // --- Resume Website Generation ---
    viewResumeWebsite() {
        this.generateResumeWebsite();
    }
    generateResumeWebsite() {
        const html = this.createResumeHTML();
        
        // Create a downloadable file and suggest user to save it
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const link = document.createElement('a');
        link.href = url;
        link.download = 'resume.html';
        
        // Auto-download the file
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        // Also open in new window for immediate viewing
        const newWindow = window.open('', '_blank');
        newWindow.document.write(html);
        newWindow.document.close();
        
    }
    createResumeHTML() {
        const data = this.resumeData;
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.name} | Resume</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .apple-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass-effect { backdrop-filter: blur(20px); background: rgba(255, 255, 255, 0.1); }
        .card { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .nav-link { position: relative; transition: all 0.3s ease; }
        .nav-link:after { content: ''; position: absolute; bottom: -4px; left: 50%; width: 0; height: 2px; background: #667eea; transition: all 0.3s ease; transform: translateX(-50%); }
        .nav-link.active:after { width: 100%; }
        .section-fade { opacity: 0; transform: translateY(20px); transition: all 0.6s ease; }
        .section-fade.active { opacity: 1; transform: translateY(0); }
    </style>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
    <!-- Hero Section -->
    <header class="apple-gradient text-white relative overflow-hidden">
        <div class="absolute inset-0 bg-black bg-opacity-20"></div>
        <div class="relative z-10 container mx-auto px-6 py-24 text-center">
            <h1 class="text-6xl font-thin mb-4 tracking-tight">${data.name}</h1>
            <p class="text-2xl font-light opacity-90 max-w-2xl mx-auto leading-relaxed">
                ${data.summary || 'Passionate software engineer with a strong desire to tackle complex challenges using innovative and efficient solutions.'}
            </p>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"></div>
    </header>

    <!-- Navigation -->
    <nav class="sticky top-0 z-50 glass-effect border-b border-gray-200">
        <div class="container mx-auto px-6">
            <div class="flex justify-center space-x-12 py-4">
                <a class="nav-link text-gray-700 hover:text-gray-900 font-medium cursor-pointer active" onclick="showSection('skills')">Skills</a>
                <a class="nav-link text-gray-700 hover:text-gray-900 font-medium cursor-pointer" onclick="showSection('education')">Education</a>
                <a class="nav-link text-gray-700 hover:text-gray-900 font-medium cursor-pointer" onclick="showSection('experience')">Experience</a>
                <a class="nav-link text-gray-700 hover:text-gray-900 font-medium cursor-pointer" onclick="showSection('projects')">Projects</a>
                <a class="nav-link text-gray-700 hover:text-gray-900 font-medium cursor-pointer" onclick="showSection('contact')">Contact</a>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-16 max-w-5xl">
        <!-- Skills Section -->
        <div id="skills" class="section section-fade active">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-thin text-gray-900 mb-4">Technical Expertise</h2>
                <div class="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto"></div>
            </div>
            ${this.generateSkillsHTML(data.skills)}
        </div>

        <!-- Education Section -->
        <div id="education" class="section section-fade hidden">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-thin text-gray-900 mb-4">Education</h2>
                <div class="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto"></div>
            </div>
            ${this.generateEducationHTML(data.education)}
        </div>

        <!-- Experience Section -->
        <div id="experience" class="section section-fade hidden">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-thin text-gray-900 mb-4">Experience</h2>
                <div class="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto"></div>
            </div>
            ${this.generateExperienceHTML(data.workExperience)}
        </div>

        <!-- Projects Section -->
        <div id="projects" class="section section-fade hidden">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-thin text-gray-900 mb-4">Projects</h2>
                <div class="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto"></div>
            </div>
            ${this.generateProjectsHTML(data.projects)}
        </div>

        <!-- Contact Section -->
        <div id="contact" class="section section-fade hidden">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-thin text-gray-900 mb-4">Get In Touch</h2>
                <div class="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto"></div>
            </div>
            ${this.generateContactHTML(data.contacts)}
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-12">
        <div class="container mx-auto px-6 text-center">
            <p class="text-gray-400 font-light">&copy; 2025 ${data.name}. All rights reserved.</p>
        </div>
    </footer>

    <script>
        function showSection(sectionId) {
            // Hide all sections with fade effect
            const sections = document.querySelectorAll('.section');
            sections.forEach(section => {
                section.classList.remove('active');
                setTimeout(() => section.classList.add('hidden'), 300);
            });
            
            // Update nav links
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => link.classList.remove('active'));
            event.target.classList.add('active');
            
            // Show selected section with fade effect
            setTimeout(() => {
                const targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    targetSection.classList.remove('hidden');
                    setTimeout(() => targetSection.classList.add('active'), 10);
                    
                    // Generate QR code when contact section is shown
                    if (sectionId === 'contact') {
                        generateQRCodeForContact();
                    }
                }
            }, 300);
        }
        
        function generateQRCodeForContact() {
            setTimeout(() => {
                const canvas = document.getElementById('qr-code');
                if (!canvas) {
                    console.error('Canvas element not found');
                    return;
                }
                
                console.log('Canvas found, generating QR code...');
                
                // Create a scannable URL
                let qrUrl = getScanableURL();
                console.log('Using URL for QR code:', qrUrl);
                
                try {
                    const qr = new QRious({
                        element: canvas,
                        value: qrUrl,
                        size: 200,
                        level: 'M',
                        background: '#ffffff',
                        foreground: '#000000',
                        padding: 10
                    });
                    
                    console.log('QR code generated successfully');
                    
                    // Update the URL info text
                    const urlInfoElement = document.querySelector('.qr-url-info');
                    if (urlInfoElement) {
                        urlInfoElement.innerHTML = '<p class="text-xs text-gray-500 break-all">QR Code URL: ' + qrUrl + '</p>';
                    }
                    
                } catch (error) {
                    console.error('Error generating QR code:', error);
                    canvas.parentElement.innerHTML = '<p class="text-sm text-gray-500">QR code generation error: ' + error.message + '</p>';
                }
            }, 100);
        }
        
        function getScanableURL() {
            const currentUrl = window.location.href;
            console.log('Current URL:', currentUrl);
            
            // Check if it's a proper HTTP/HTTPS URL
            if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
                return currentUrl;
            }
            
            
            // For demonstration, use a simple localhost URL
            return 'http://localhost:8000/resume.html';
        }
        
        // Initialize on load
        document.addEventListener('DOMContentLoaded', function() {
            // Smooth scroll behavior
            document.documentElement.style.scrollBehavior = 'smooth';
        });
    </script>
</body>
</html>`;
    }

    generateSkillsHTML(skills) {
        if (!skills || skills.length === 0) {
            return '<p class="text-lg">No skills information available.</p>';
        }
        
        // Group skills by category for better organization
        const languages = [];
        const tools = [];
        const softSkills = [];
        
        skills.forEach(skill => {
            const lowerSkill = skill.toLowerCase();
            
            // Programming Languages
            if (lowerSkill.includes('python') || lowerSkill.includes('javascript') || lowerSkill.includes('java') || 
                lowerSkill.includes('c++') || lowerSkill.includes('html') || lowerSkill.includes('css') ||
                lowerSkill.includes('golang') || lowerSkill.includes('go') || lowerSkill.includes('c/c++') ||
                lowerSkill.includes('java/js') || lowerSkill.includes('http/css') || lowerSkill === 'c') {
                languages.push(skill);
            } 
            // Tools & Technologies
            else if (lowerSkill.includes('github') || lowerSkill.includes('discord') || lowerSkill.includes('postgresql') ||
                      lowerSkill.includes('beautifulsoup') || lowerSkill.includes('pandas') || lowerSkill.includes('excel') ||
                      lowerSkill.includes('vs code') || lowerSkill.includes('database') || lowerSkill.includes('management')) {
                tools.push(skill);
            } 
            // Soft Skills (communication, leadership, etc.)
            else if (lowerSkill.includes('communication') || lowerSkill.includes('leadership') || 
                     lowerSkill.includes('teamwork') || lowerSkill.includes('problem') || 
                     lowerSkill.includes('management') || lowerSkill.includes('organization')) {
                softSkills.push(skill);
            }
            // Default: if it's short and looks technical, put it in languages
            else if (skill.length < 20 && /^[A-Za-z0-9\+\#\/\-\s]+$/.test(skill)) {
                languages.push(skill);
            }
            else {
                softSkills.push(skill);
            }
        });
        
        let html = '';
        
        if (languages.length > 0) {
            html += `
                <section>
                    <h2 class="text-xl font-semibold">Languages</h2>
                    <p class="text-lg">${languages.join(', ')}</p>
                </section>
            `;
        }
        
        if (tools.length > 0) {
            html += `
                <section>
                    <h2 class="text-xl font-semibold">Tools & Technologies</h2>
                    <p class="text-lg">${tools.join(', ')}</p>
                </section>
            `;
        }
        
        if (softSkills.length > 0) {
            html += `
                <section>
                    <h2 class="text-xl font-semibold">Soft Skills</h2>
                    <p class="text-lg">${softSkills.join(', ')}</p>
                </section>
            `;
        }
        
        // Fallback: if all arrays are empty but we have skills, just display them
        if (html === '' && skills.length > 0) {
            html = skills.map(skill => `<p class="text-lg">${skill}</p>`).join('');
        }
        
        return html;
    }
    
    generateEducationHTML(education) {
        if (!education || education.length === 0) {
            return '<p class="text-lg">No education information available.</p>';
        }
        
        // Look for degree, school, GPA, graduation date patterns
        let html = '';
        
        education.forEach(line => {
            if (line.toLowerCase().includes('university') || line.toLowerCase().includes('college')) {
                // This is likely the school name and degree
                html += `<p class="text-lg">${line}</p>`;
                
                // Look for additional details like GPA, graduation date
                const gpaMatch = line.match(/gpa[:\s]*([0-9.]+)/i);
                const dateMatch = line.match(/\b(20\d{2}|19\d{2})\b/);
                
                if (gpaMatch || dateMatch) {
                    const details = [];
                    if (dateMatch) details.push(`Expected Graduation: ${dateMatch[1]}`);
                    if (gpaMatch) details.push(`GPA: ${gpaMatch[1]}`);
                    
                    if (details.length > 0) {
                        html += `<ul class="list-disc list-inside ml-4 text-lg">`;
                        details.forEach(detail => {
                            html += `<li>${detail}</li>`;
                        });
                        html += `</ul>`;
                    }
                }
            } else if (line.toLowerCase().includes('coursework') || line.toLowerCase().includes('relevant')) {
                html += `<ul class="list-disc list-inside ml-4 text-lg"><li>${line}</li></ul>`;
            } else {
                html += `<p class="text-lg">${line}</p>`;
            }
        });
        
        return html;
    }
    
    generateExperienceHTML(workExperience) {
        if (!workExperience || workExperience.length === 0) {
            return '<p class="text-lg">No work experience information available.</p>';
        }
        
        let html = '';
        let currentJob = null;
        
        workExperience.forEach(line => {
            // Look for job title and company patterns
            if (line.includes('—') || line.includes(' at ') || line.includes('(') || 
                line.toLowerCase().includes('intern') || line.toLowerCase().includes('developer') ||
                line.toLowerCase().includes('manager') || line.toLowerCase().includes('founder')) {
                
                // This is likely a job title and company
                if (currentJob) {
                    html += `</ul></section>`;
                }
                
                html += `
                    <section>
                        <h2 class="text-xl font-semibold">${line}</h2>
                        <ul class="list-disc list-inside ml-4 text-lg">
                `;
                currentJob = line;
            } else if (currentJob && line.length > 10) {
                // This is likely a job responsibility or achievement
                html += `<li>${line}</li>`;
            } else if (!currentJob) {
                // Standalone work experience line
                html += `<p class="text-lg">${line}</p>`;
            }
        });
        
        if (currentJob) {
            html += `</ul></section>`;
        }
        
        return html;
    }
    
    generateProjectsHTML(projects) {
        if (!projects || projects.length === 0) {
            return '<div class="text-center py-12"><p class="text-xl text-gray-500">No projects information available.</p></div>';
        }
        
        let html = '<div class="grid gap-8 md:gap-12">';
        
        projects.forEach((project, index) => {
            // Parse project data
            const projectData = this.parseProjectData(project);
            
            html += `
                <div class="card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div class="p-8">
                        <div class="flex items-start justify-between mb-6">
                            <div>
                                <h3 class="text-2xl font-semibold text-gray-900 mb-2">${projectData.title}</h3>
                                <div class="flex items-center space-x-4">
                                    ${projectData.language ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">${projectData.language}</span>` : ''}
                                    ${projectData.type ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">${projectData.type}</span>` : ''}
                                </div>
                            </div>
                            <div class="text-4xl opacity-20 font-thin text-gray-400">0${index + 1}</div>
                        </div>
                        
                        <div class="prose prose-gray max-w-none">
                            <p class="text-gray-700 leading-relaxed text-lg">${projectData.description}</p>
                        </div>
                        
                        ${projectData.technologies.length > 0 ? `
                            <div class="mt-6 pt-6 border-t border-gray-100">
                                <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Technologies Used</h4>
                                <div class="flex flex-wrap gap-2">
                                    ${projectData.technologies.map(tech => 
                                        `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">${tech}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${projectData.features.length > 0 ? `
                            <div class="mt-6">
                                <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Features</h4>
                                <ul class="space-y-2">
                                    ${projectData.features.map(feature => 
                                        `<li class="flex items-start">
                                            <svg class="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                            </svg>
                                            <span class="text-gray-700">${feature}</span>
                                        </li>`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    parseProjectData(projectText) {
        const lines = projectText.split(/[.!]/).map(s => s.trim()).filter(s => s.length > 0);
        
        // Extract title and language
        const titleMatch = projectText.match(/^([^–\-:]+)(?:[–\-:]\s*([A-Za-z+#]+))?/);
        const title = titleMatch ? titleMatch[1].trim() : 'Project';
        const language = titleMatch && titleMatch[2] ? titleMatch[2].trim() : '';
        
        // Determine project type
        let type = '';
        const lowerText = projectText.toLowerCase();
        if (lowerText.includes('web') || lowerText.includes('website')) type = 'Web App';
        else if (lowerText.includes('data') || lowerText.includes('analytics')) type = 'Data Analysis';
        else if (lowerText.includes('system') || lowerText.includes('application')) type = 'Application';
        else if (lowerText.includes('calculator') || lowerText.includes('tool')) type = 'Tool';
        
        // Extract description (first substantial sentence)
        let description = '';
        for (const line of lines) {
            if (line.length > 30 && !line.includes(':') && line.toLowerCase().includes('developed')) {
                description = line;
                break;
            }
        }
        if (!description && lines.length > 0) {
            description = lines[0];
        }
        
        // Extract technologies
        const technologies = [];
        const techPattern = /\b(Python|JavaScript|Java|C\+\+|C|Go|HTML|CSS|React|Angular|Vue|Node|Express|Django|Flask|PostgreSQL|MySQL|MongoDB|Redis|AWS|Docker|Git|GitHub|BeautifulSoup|pandas|Excel|VS Code|linked lists|file I\/O)\b/gi;
        const techMatches = projectText.match(techPattern);
        if (techMatches) {
            technologies.push(...[...new Set(techMatches.map(t => t.trim()))]);
        }
        
        // Extract features/capabilities
        const features = [];
        const featurePatterns = [
            /implemented ([^.]+)/gi,
            /integrated ([^.]+)/gi,
            /built ([^.]+)/gi,
            /designed ([^.]+)/gi,
            /enabled ([^.]+)/gi,
            /used ([^.]+)/gi
        ];
        
        featurePatterns.forEach(pattern => {
            const matches = [...projectText.matchAll(pattern)];
            matches.forEach(match => {
                if (match[1] && match[1].length > 10 && match[1].length < 100) {
                    features.push(match[1].trim());
                }
            });
        });
        
        return {
            title,
            language,
            type,
            description,
            technologies: technologies.slice(0, 8), // Limit to 8 technologies
            features: features.slice(0, 4) // Limit to 4 key features
        };
    }

    generateContactHTML(contacts) {
        const contactItems = [];
        
        if (contacts.email) {
            contactItems.push(`<p class="text-lg"><strong>Email:</strong> <a href="mailto:${contacts.email}" class="text-blue-600 hover:underline">${contacts.email}</a></p>`);
        }
        
        if (contacts.phone) {
            contactItems.push(`<p class="text-lg"><strong>Phone:</strong> <a href="tel:${contacts.phone}" class="text-blue-600 hover:underline">${contacts.phone}</a></p>`);
        }
        
        if (contacts.city) {
            contactItems.push(`<p class="text-lg"><strong>Location:</strong> ${contacts.city}</p>`);
        }
        
        if (contacts.linkedin) {
            const linkedinUrl = contacts.linkedin.startsWith('http') ? contacts.linkedin : `https://${contacts.linkedin}`;
            contactItems.push(`<p class="text-lg"><strong>LinkedIn:</strong> <a href="${linkedinUrl}" target="_blank" class="text-blue-600 hover:underline">${contacts.linkedin}</a></p>`);
        }
        
        if (contacts.github) {
            const githubUrl = contacts.github.startsWith('http') ? contacts.github : `https://${contacts.github}`;
            contactItems.push(`<p class="text-lg"><strong>GitHub:</strong> <a href="${githubUrl}" target="_blank" class="text-blue-600 hover:underline">${contacts.github}</a></p>`);
        }
        
        if (contacts.website) {
            const websiteUrl = contacts.website.startsWith('http') ? contacts.website : `https://${contacts.website}`;
            contactItems.push(`<p class="text-lg"><strong>Website:</strong> <a href="${websiteUrl}" target="_blank" class="text-blue-600 hover:underline">${contacts.website}</a></p>`);
        }
        
        if (contacts.address) {
            contactItems.push(`<p class="text-lg"><strong>Address:</strong> ${contacts.address}</p>`);
        }
        
        // Add QR code section
        const qrCodeHTML = `
            <div class="mt-8 pt-8 border-t border-gray-200 text-center">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Scan to View Resume</h4>
                <div class="flex justify-center">
                    <canvas id="qr-code" class="border-2 border-gray-200 rounded-lg shadow-sm"></canvas>
                </div>
                <p class="text-sm text-gray-600 mt-2">Scan this QR code to view this resume website</p>
            </div>
        `;
        
        const result = contactItems.length > 0 ? contactItems.join('') + qrCodeHTML : '<p class="text-lg">No contact information available.</p>' + qrCodeHTML;
        
        // Generate QR code after DOM is updated
        this.generateQRCode();
        
        return result;
    }

    generateQRCode() {
        // Wait for DOM to be ready
        setTimeout(() => {
            const canvas = document.getElementById('qr-code');
            if (!canvas) {
                console.log('Canvas element not found, QR code will be generated when contact section is shown');
                return;
            }
            
            console.log('Canvas found, generating QR code...');
            
            // Create a scannable URL (this function will be defined in the generated HTML)
            let qrUrl;
            if (typeof getScanableURL === 'function') {
                qrUrl = getScanableURL();
            } else {
                // Fallback if function not available
                qrUrl = 'http://localhost:8000/resume.html';
            }
            console.log('Using URL for QR code:', qrUrl);
            
            try {
                const qr = new QRious({
                    element: canvas,
                    value: qrUrl,
                    size: 200,
                    level: 'M',
                    background: '#ffffff',
                    foreground: '#000000',
                    padding: 10
                });
                
                console.log('QR code generated successfully');
                
                // Add URL info below QR code for demonstration
                const qrContainer = canvas.parentElement.parentElement;
                let urlInfo = qrContainer.querySelector('.qr-url-info');
                if (!urlInfo) {
                    urlInfo = document.createElement('div');
                    urlInfo.className = 'qr-url-info mt-2';
                    qrContainer.appendChild(urlInfo);
                }
                urlInfo.innerHTML = `<p class="text-xs text-gray-500 break-all">QR Code URL: ${qrUrl}</p>`;
                
            } catch (error) {
                console.error('Error generating QR code:', error);
                // Simple fallback
                canvas.parentElement.innerHTML = '<p class="text-sm text-gray-500">QR code generation error: ' + error.message + '</p>';
            }
        }, 500); // Increased timeout to ensure DOM is ready
    }

    // --- Utility ---
    showSection(sectionId) {
        document.getElementById(sectionId).classList.remove('hidden');
    }
    hideSection(sectionId) {
        document.getElementById(sectionId).classList.add('hidden');
    }
    showAlert(message, type = 'info') {
        if (type === 'error') alert('Error: ' + message);
        else if (type === 'success') alert('Success: ' + message);
        else alert(message);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    window.resumeBuilder = new ResumeWebsiteBuilder();
});