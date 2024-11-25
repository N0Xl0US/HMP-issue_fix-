document.getElementById('sign-up2').addEventListener('click', function() {
    window.location.href = "{{ url_for('login_signup') }}";
  });