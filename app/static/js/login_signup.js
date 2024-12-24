document.addEventListener('DOMContentLoaded', () => {
    // Toggle panels for sign-up and sign-in
    const container = document.getElementById('container');
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');

    if (signUpButton && signInButton) {
        signUpButton.addEventListener('click', () => container.classList.add('right-panel-active'));
        signInButton.addEventListener('click', () => container.classList.remove('right-panel-active'));
    }

    // Helper function to show messages
    function showMessage(target, message, type = "error") {
        const messageDiv = document.getElementById(target);
        if (messageDiv) {
            messageDiv.style.display = "block";
            messageDiv.textContent = message;
            messageDiv.className = `message ${type}`; // Add class for styling (success/error)
        }
    }

    const NotificationSystem = {
        show(message, type = 'error', duration = 5000) {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), duration);
        },
        
        error(message) {
            this.show(message, 'error');
        },
        
        success(message) {
            this.show(message, 'success');
        }
    };

    // Handle signup
    const signUpForm = document.querySelector("form[action='/signup']");
    if (signUpForm) {
        signUpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("signupName").value;
            const email = document.getElementById("signupEmail").value;
            const password = document.getElementById("signupPassword").value;
            
            // Get selected chronic conditions
            
            const conditionsSelect = document.getElementById("chronic-conditions");
            const selectedConditions = Array.from(conditionsSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value !== 'none')
                .join(', ');

            try {
                const response = await fetch("/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        chronic_conditions: selectedConditions
                    }),
                });
                const data = await response.json();
                if (data.success) {
                    showVerificationForm(email);
                } else {
                    showMessage("signupError", data.message || "Signup failed. Please try again.", "error");
                }
            } catch (error) {
                console.error('Error during signup:', error);
                showMessage("signupError", "An unexpected error occurred. Please try again.", "error");
            }
        });
    }

    // Handle login
    const signInForm = document.querySelector("form[action='/login']");
    if (signInForm) {
        signInForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const { email, password } = Object.fromEntries(new FormData(e.target));
            showMessage("signInMessage", ""); // Clear previous messages

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    window.location.href = "/dashboard";
                } else {
                    showMessage("signInMessage", result.message || "Invalid email or password.", "error");
                }
            } catch (error) {
                console.error("Error during login:", error);
                showMessage("signInMessage", "An unexpected error occurred. Please try again.", "error");
            }
        });
    }

    // Handle email verification (OTP submission)
    const verifyButton = document.getElementById("verifyButton");
    if (verifyButton) {
        verifyButton.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = document.getElementById("verificationEmail").value;
            const code = document.getElementById("verificationCode").value;
            
            try {
                const response = await fetch("/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code }),
                });
                const data = await response.json();
                
                if (data.success) {
                    NotificationSystem.success("Email verified successfully!");
                    window.location.href = "/dashboard";
                } else {
                    NotificationSystem.error(data.message || "Invalid verification code");
                }
            } catch (error) {
                console.error('Error:', error);
                NotificationSystem.error("An unexpected error occurred");
            }
        });
    }

    // Forgot Password
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            
            try {
                const response = await fetch('/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, type: 'reset' })
                });
                const data = await response.json();
                
                if (data.success) {
                    NotificationSystem.success('OTP sent to your email!');
                    switchForm('otp-form', 'forgot-password-form');
                } else {
                    NotificationSystem.error(data.message || 'Error sending OTP');
                }
            } catch (error) {
                console.error('Error:', error);
                NotificationSystem.error('An unexpected error occurred');
            }
        });
    }

    // OTP verification form handler
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const otp = document.getElementById('otp').value;
            
            try {
                const response = await fetch('/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, type: 'reset' })
                });
                const data = await response.json();
                
                if (data.success) {
                    NotificationSystem.success('OTP verified!');
                    switchForm('reset-password-form', 'otp-form');
                } else {
                    NotificationSystem.error(data.message || 'Invalid OTP');
                }
            } catch (error) {
                console.error('Error:', error);
                NotificationSystem.error('An unexpected error occurred');
            }
        });
    }

    // Helper function to switch between forms
    function switchForm(showFormId, ...hideFormIds) {
        const showForm = document.getElementById(showFormId);
        if (showForm) {
            showForm.style.display = 'block';
        }
        
        hideFormIds.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.style.display = 'none';
            }
        });
    }

    // Helper Function to Show OTP Field
    function showOtpField() {
        const otpField = document.getElementById('otp');
        if (!otpField) {
            const otpInput = document.createElement('input');
            otpInput.type = 'text';
            otpInput.placeholder = 'Enter OTP';
            otpInput.id = 'otp';
            document.getElementById('forgot-password-form').appendChild(otpInput);

            const verifyButton = document.createElement('button');
            verifyButton.type = 'button';
            verifyButton.textContent = 'Verify OTP';
            verifyButton.id = 'verify-otp-button';
            verifyButton.addEventListener('click', verifyOtp);
            document.getElementById('forgot-password-form').appendChild(verifyButton);
        }
    }

    // Verify OTP
    async function verifyOtp() {
        const email = document.getElementById('forgot-email').value;
        const otp = document.getElementById('otp').value;
        showMessage("forgotPasswordMessage", ""); // Clear previous messages

        try {
            const response = await fetch('/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await response.json();
            if (data.success) {
                showMessage("forgotPasswordMessage", "OTP verified! You can reset your password.", "success");
                // Show password reset fields here
            } else {
                showMessage("forgotPasswordMessage", data.message || "Invalid OTP.", "error");
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            showMessage("forgotPasswordMessage", "An unexpected error occurred. Please try again.", "error");
        }
    }

    // Toggle between Sign In and Forgot Password
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const signInContainer = document.querySelector('.sign-in-container');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function (e) {
            e.preventDefault();
            signInContainer.style.display = 'none';
            forgotPasswordForm.style.display = 'block';
        });
    }

    const backToSignInLink = document.getElementById('back-to-sign-in-link');
    if (backToSignInLink) {
        backToSignInLink.addEventListener('click', function (e) {
            e.preventDefault();
            signInContainer.style.display = 'block';
            forgotPasswordForm.style.display = 'none';
        });
    }

    const conditionsSelect = document.getElementById("chronic-conditions");
    if (conditionsSelect) {
        const selectedConditionsDiv = document.getElementById("selected-conditions");
        
        function updateSelectedConditions() {
            const selectedOptions = Array.from(conditionsSelect.selectedOptions);
            selectedConditionsDiv.innerHTML = '';
            
            // If no conditions are selected or only "none" is selected
            if (selectedOptions.length === 0 || 
                (selectedOptions.length === 1 && selectedOptions[0].value === 'none')) {
                selectedConditionsDiv.innerHTML = '<p class="condition-tag">No conditions selected</p>';
                return;
            }
            
            // Filter out "none" option and create tags
            selectedOptions
                .filter(option => option.value !== 'none')
                .forEach(option => {
                    const tag = document.createElement('span');
                    tag.className = 'condition-tag';
                    tag.textContent = option.text;
                    selectedConditionsDiv.appendChild(tag);
                });
        }
        
        // Handle selection changes
        conditionsSelect.addEventListener('change', (e) => {
            // If "none" is selected, deselect everything else
            if (Array.from(conditionsSelect.selectedOptions).some(opt => opt.value === 'none')) {
                Array.from(conditionsSelect.options).forEach(opt => {
                    if (opt.value !== 'none') opt.selected = false;
                });
            }
            // If anything else is selected, deselect "none"
            else if (e.target.value !== 'none') {
                const noneOption = Array.from(conditionsSelect.options).find(opt => opt.value === 'none');
                if (noneOption) noneOption.selected = false;
            }
            
            updateSelectedConditions();
        });
        
        // Initial update
        updateSelectedConditions();
    }

    // Add these functions near the top of the file
    function showVerificationForm(email) {
        const modal = document.getElementById('verificationModal');
        const emailInput = document.getElementById('verificationEmail');
        if (modal && emailInput) {
            emailInput.value = email;
            modal.style.display = 'block';
        }
    }

    function showMessage(elementId, message, type = 'error') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = message ? 'block' : 'none';
            element.className = `message ${type}`;
        }
    }

    // Add this after your existing event listeners
    const verificationForm = document.querySelector('#verificationModal form');
    if (verificationForm) {
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('verificationEmail').value;
            const code = document.getElementById('verificationCode').value;
            
            try {
                const response = await fetch('/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });
                
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/dashboard';
                } else {
                    showMessage('verificationError', data.message || 'Verification failed');
                }
            } catch (error) {
                console.error('Error during verification:', error);
                showMessage('verificationError', 'An unexpected error occurred');
            }
        });
    }

    // Add modal close functionality
    const closeBtn = document.querySelector('.modal .close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('verificationModal').style.display = 'none';
        }
    }

    // Close modal when clicking outside of it
    window.onclick = function(event) {
        const modal = document.getElementById('verificationModal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // Add password reset handler
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // Add password validation
            if (newPassword.length < 8) {
                NotificationSystem.error("Password must be at least 8 characters long");
                return;
            }

            if (!/[A-Z]/.test(newPassword)) {
                NotificationSystem.error("Password must contain at least one uppercase letter");
                return;
            }

            if (!/[0-9]/.test(newPassword)) {
                NotificationSystem.error("Password must contain at least one number");
                return;
            }

            if (newPassword !== confirmPassword) {
                NotificationSystem.error("Passwords don't match!");
                return;
            }

            try {
                const response = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: newPassword })
                });
                const data = await response.json();

                if (data.success) {
                    NotificationSystem.success('Password reset successfully!');
                    // Clear the forms
                    resetPasswordForm.reset();
                    document.getElementById('forgot-password-form').reset();
                    document.getElementById('otp-form').reset();
                    // Hide the reset password form
                    resetPasswordForm.style.display = 'none';
                    // Show the login form
                    document.getElementById('login-form').style.display = 'block';
                } else {
                    NotificationSystem.error(data.message || 'Failed to reset password');
                }
            } catch (error) {
                console.error('Error:', error);
                NotificationSystem.error('An unexpected error occurred');
            }
        });
    }
});