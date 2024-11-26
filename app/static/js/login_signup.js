document.addEventListener('DOMContentLoaded', () => {
    // Toggle panels for sign-up and sign-in
    const container = document.getElementById('container');
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');

    if (signUpButton && signInButton) {
        signUpButton.addEventListener('click', () => container.classList.add('right-panel-active'));
        signInButton.addEventListener('click', () => container.classList.remove('right-panel-active'));
    }

    // Handle signup
    const signUpForm = document.querySelector("form[action='/signup']");
    if (signUpForm) {
        signUpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const { name, email, password } = Object.fromEntries(new FormData(e.target));
            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    // If signup is successful, show email verification modal and redirect
                    document.getElementById("verificationModal").style.display = "flex";
                    document.getElementById("verificationEmail").value = email;

                    // Redirect to dashboard after successful signup (you may choose to redirect here)
                    window.location.href = "/dashboard";  // Uncomment this if you want to auto-redirect after signup
                } else {
                    alert(result.message || "Signup failed.");
                }
            } catch (error) {
                console.error("Error during signup:", error);
            }
        });
    }

    const signInForm = document.querySelector("form[action='/login']");
    if (signInForm) {
        signInForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const { email, password } = Object.fromEntries(new FormData(e.target));
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    // Redirect to dashboard on successful login
                    window.location.href = "/dashboard";  // Redirect to dashboard after successful login
                } else {
                    alert(result.message || "Login failed.");
                }
            } catch (error) {
                console.error("Error during login:", error);
            }
        });
    }

    // Handle email verification (OTP submission)
    const verifyButton = document.getElementById("verifyButton");
    if (verifyButton) {
        verifyButton.addEventListener("click", async (e) => {
            e.preventDefault(); // Prevent form from submitting
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
                    window.location.href = "/dashboard";  // Redirect to dashboard after successful verification
                } else {
                    document.getElementById("verificationError").style.display = "block";  // Show error if code is invalid
                }
            } catch (error) {
                console.error('Error verifying code:', error);
                alert('An error occurred. Please try again.');
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
                    body: JSON.stringify({ email }),
                });
                const data = await response.json();
                if (data.success) {
                    alert('OTP sent to your email!');
                    showOtpField();
                } else {
                    alert(data.message || 'Error sending OTP');
                }
            } catch (error) {
                console.error('Error sending OTP:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
    
    // Helper Functions
    function showOtpField() {
        const otpField = document.createElement('input');
        otpField.type = 'text';
        otpField.placeholder = 'Enter OTP';
        otpField.id = 'otp';
        document.getElementById('forgot-password-form').appendChild(otpField);
        const verifyButton = document.createElement('button');
        verifyButton.type = 'button';
        verifyButton.textContent = 'Verify OTP';
        document.getElementById('forgot-password-form').appendChild(verifyButton);
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const container = document.getElementById('container');
    const signInContainer = document.querySelector('.sign-in-container');
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent default link behavior

            // Hide sign-in container and show forgot-password form
            signInContainer.style.display = 'none';
            forgotPasswordForm.style.display = 'block'; // Show forgot password form
        });
    }

    const backToSignInLink = document.getElementById('back-to-sign-in-link');
    if (backToSignInLink) {
        backToSignInLink.addEventListener('click', function(e) {
            e.preventDefault();
            // Show sign-in container again and hide forgot-password form
            signInContainer.style.display = 'block';
            forgotPasswordForm.style.display = 'none'; // Hide forgot password form
        });
    }
});