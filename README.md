# chatbot

This project is a smart voice assistant that runs in the browser and uses the Gemini API to respond to the user.

The following programming adjustments were made to ensure the system works correctly:
File Name Change: The server connection file was renamed from chat.php to mo.php.

Link Path Update: The BACKEND_URL variable inside the app.js file was updated to match the new file name and path api/mo.php.

Fixing the Key Validation Logic: In the original code, the PHP file only checked if the key was exactly equal to the 
placeholder text. However, because config.php initially defines the key as an empty string, the programmatic condition was modified to:
  if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '' || GEMINI_API_KEY === 'ضع_مفتاحك_هنا').

after fixing every thing i went to aistudio.google.com to generate my own api which was added to config.php ( replaced it with an empty string in the uploaded files).
  

