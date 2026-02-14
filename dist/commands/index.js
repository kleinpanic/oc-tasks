import { registerList } from './list.js';
import { registerAdd } from './add.js';
import { registerShow } from './show.js';
import { registerDone } from './done.js';
import { registerMove } from './move.js';
import { registerBlock } from './block.js';
import { registerUpdate } from './update.js';
import { registerDelete } from './delete.js';
import { registerSearch } from './search.js';
import { registerOverdue } from './overdue.js';
import { registerSla } from './sla.js';
import { registerBackburner } from './backburner.js';
import { registerTriage } from './triage.js';
import { registerNext } from './next.js';
import { registerTimer } from './timer.js';
import { registerSync } from './sync.js';
import { registerMigrate } from './migrate.js';
import { registerStats } from './stats.js';
export function registerAllCommands(program) {
    registerList(program);
    registerAdd(program);
    registerShow(program);
    registerDone(program);
    registerMove(program);
    registerBlock(program);
    registerUpdate(program);
    registerDelete(program);
    registerSearch(program);
    registerOverdue(program);
    registerSla(program);
    registerBackburner(program);
    registerTriage(program);
    registerNext(program);
    registerTimer(program);
    registerSync(program);
    registerMigrate(program);
    registerStats(program);
}
//# sourceMappingURL=index.js.map