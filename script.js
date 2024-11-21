// Existing code: Handles UI toggling
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

// Existing code: Social login (optional)
document.getElementById('fbLogin').addEventListener('click', function() {
    window.open('https://www.facebook.com/v11.0/dialog/oauth?client_id=YOUR_FACEBOOK_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=email', '_blank');
});

document.getElementById('googleLogin').addEventListener('click', function() {
    window.open('https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_GOOGLE_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=email', '_blank');
});

// New code: Handle signup form submission
document.querySelector('.sign-up-container form').addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent the default form submission behavior

    // Collect data from the form inputs
    const name = document.querySelector('.sign-up-container input[placeholder="Name"]').value;
    const email = document.querySelector('.sign-up-container input[placeholder="Email"]').value;
    const password = document.querySelector('.sign-up-container input[placeholder="Password"]').value;

    try {
        // Send the data to the backend
        const response = await fetch('http://127.0.0.1:5000/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        const result = await response.json();
        alert(result.message); // Display the message returned from the backend
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
});
