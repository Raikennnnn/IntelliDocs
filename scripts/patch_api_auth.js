const fs = require('fs');
const path = require('path');

const dir = 'c:/xampp/htdocs/IntelliDocs/api';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.php'));

const blockPattern =
  /\$actorId = \(int\)\(\$_SERVER\['HTTP_X_USER_ID'\][\s\S]*?runAuthenticatedSecurityGuards\(\$pdo, \$actorId, '([^']+)'\);\r?\n/;

const userIdBlockPattern =
  /\$userId = \(int\)\(\$_SERVER\['HTTP_X_USER_ID'\][\s\S]*?runAuthenticatedSecurityGuards\(\$pdo, \$userId, '([^']+)'\);\r?\n/;

for (const f of files) {
  if (f === 'session_token.php' || f === 'auth.php' || f === 'api_auth.php') continue;
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('HTTP_X_USER_ID')) continue;

  let label = null;
  let m = s.match(blockPattern);
  if (m) label = m[1];
  if (!label) {
    m = s.match(userIdBlockPattern);
    if (m) label = m[1];
  }
  if (!label) {
    console.log('SKIP (no guard block)', f);
    continue;
  }

  const varName = s.match(userIdBlockPattern) ? 'userId' : 'actorId';
  const replacement =
    "require_once __DIR__ . '/api_auth.php';\n" +
    `$actor = apiRequireActor($pdo, '${label}');\n` +
    `$${varName} = $actor['id'];\n` +
    (varName === 'actorId' ? "$actorRole = $actor['role'];\n" : '');

  s = s.replace(blockPattern, replacement).replace(userIdBlockPattern, replacement);
  fs.writeFileSync(p, s);
  console.log('patched', f, '->', label);
}
