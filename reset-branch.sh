rm -rf .git
git init
git add .
git commit -m "Initial Commit"
git remote add origin https://gitlab.com/debrava/server-api.git
git push origin master --force