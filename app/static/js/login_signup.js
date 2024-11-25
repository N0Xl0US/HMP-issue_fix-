const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');
const verificationModal = document.getElementById("verificationModal");
const verifyButton = document.getElementById("verifyButton");
const verificationError = document.getElementById("verificationError");

signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

// Handle form submission for signup
document.querySelector("form[action='/signup']").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;

    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (response.ok) {
            // Show verification modal
            verificationModal.style.display = "flex";

            // Populate hidden fields in verification form
            document.getElementById("verificationEmail").value = email;
        } else {
            alert(result.message || "Signup failed.");
        }
    } catch (error) {
        console.error("Error during signup:", error);
    }
});

// Handle email verification
verifyButton.addEventListener("click", async () => {
    const code = document.getElementById("verificationCode").value;
    const email = document.getElementById("verificationEmail").value; // You might want to pass email explicitly

    try {
        const response = await fetch("/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, email }),
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = "/dashboard"; // Redirect to the dashboard
        } else {
            verificationError.style.display = "block"; // Show error message
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        alert('An error occurred. Please try again.');
    }
});

// Handle form submission for sign-in (if applicable)
document.querySelector("form[action='/signin']").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
        // Send sign-in request
        const response = await fetch('/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (response.ok) {
            window.location.href = "/dashboard"; // Redirect to the dashboard
        } else {
            alert(result.message || "Sign-in failed.");
        }
    } catch (error) {
        console.error("Error during sign-in:", error);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('.sign-in-container').style.display = 'none';
            document.querySelector('.forgot-password-container').style.display = 'block';
        });
    }
});

document.getElementById('forgot-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    // Send the email to the server to generate an OTP
    try {
        const response = await fetch('/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
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

function showOtpField() {
    // Hide the email field and submit button
    document.getElementById('forgot-email').disabled = true;
    document.querySelector('button[type="submit"]').style.display = 'none';

    // Add OTP verification fields
    const otpField = document.createElement('input');
    otpField.type = 'text';
    otpField.placeholder = 'Enter OTP';
    otpField.id = 'otp';
    otpField.required = true;

    const verifyButton = document.createElement('button');
    verifyButton.type = 'button';
    verifyButton.textContent = 'Verify OTP';
    verifyButton.onclick = verifyOtp;

    document.querySelector('#forgot-password-form').append(otpField, verifyButton);
}

async function verifyOtp() {
    const otp = document.getElementById('otp').value;
    const email = document.getElementById('forgot-email').value;

    try {
        const response = await fetch('/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();
        if (data.success) {
            showResetPasswordFields();
        } else {
            alert('Invalid OTP. Please try again.');
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        alert('An error occurred. Please try again.');
    }
}

function showResetPasswordFields() {
    // Remove OTP field and add reset password fields
    document.getElementById('otp').disabled = true;
    document.querySelector('button[type="button"]').style.display = 'none';

    const newPasswordField = document.createElement('input');
    newPasswordField.type = 'password';
    newPasswordField.placeholder = 'New Password';
    newPasswordField.id = 'new-password';
    newPasswordField.required = true;

    const confirmPasswordField = document.createElement('input');
    confirmPasswordField.type = 'password';
    confirmPasswordField.placeholder = 'Confirm Password';
    confirmPasswordField.id = 'confirm-password';
    confirmPasswordField.required = true;

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = 'Reset Password';
    resetButton.onclick = resetPassword;

    document.querySelector('#forgot-password-form').append(newPasswordField, confirmPasswordField, resetButton);
}

async function resetPassword() {
    const email = document.getElementById('forgot-email').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });

        const data = await response.json();
        if (data.success) {
            alert('Password reset successfully');
            window.location.href = '/login';  // Redirect to login page
        } else {
            alert('Error resetting password');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('An error occurred. Please try again.');
    }
}

function verifyEmailCode() {
    const email = document.getElementById("email").value;
    const verificationCode = document.getElementById("verificationCode").value;

    fetch('/verify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        code: verificationCode
      })
    })
    .then(response => response.json())
    .then(data => {
      // Check if the response is successful
      if (data.success) {
        // Display the success message
        document.getElementById("message-container").innerHTML = `
          <div class="alert alert-success">
            ${data.message} <a href="/login">Click here to log in</a>.
          </div>
        `;
        // Optionally, you can hide the form after success
        document.getElementById("verification-form").style.display = 'none';
      } else {
        // Display the error message
        document.getElementById("message-container").innerHTML = `
          <div class="alert alert-danger">
            ${data.message}
          </div>
        `;
      }
    })
    .catch(error => {
      console.error("Error:", error);
      document.getElementById("message-container").innerHTML = `
        <div class="alert alert-danger">
          Something went wrong. Please try again.
        </div>
      `;
    });
}

// Handle Facebook and Google login buttons
document.getElementById('fbLogin').addEventListener('click', function() {
    window.open('https://www.facebook.com/v11.0/dialog/oauth?client_id=YOUR_FACEBOOK_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=email', '_blank');
});

document.getElementById('googleLogin').addEventListener('click', function() {
    window.open('https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_GOOGLE_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=email', '_blank');
});

// Switch between sign up and sign in panels
signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

// Hide the verification modal on close button click
document.getElementById("verificationModalClose").addEventListener("click", () => {
    verificationModal.style.display = "none";
});