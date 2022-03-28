echo "Installing deno..."
curl -fsSL https://deno.land/x/install/install.sh | sh
export PATH="/opt/buildhome/.deno/bin:$PATH" 
mkdir dist
echo "Building website with Vale..."

deno run -A —unstable build_website.ts