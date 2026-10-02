// Who is allowed to see which audit.
//   admin     → every audit
//   moderator → only audits belonging to users assigned to them
//   normal    → only their own audits
const database = require('../db/database');

function canAccessAudit(audit, user) {
    if (!audit) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'moderator') {
        const assignedIds = database.getAssignedUserIds(user.id);
        return assignedIds.includes(audit.user_id);
    }
    return audit.user_id === user.id;
}

module.exports = { canAccessAudit };
