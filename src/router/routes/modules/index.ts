import account from './account';
import adminAccount from './adminAccount';
import chatroom from './chatroom';
import dashboard from './dashboard';
import demos from './demos';
import distAcct from './distAcct';
import externaLink from './externa-link';
import gamesetting from './gamesetting';
import home from './home';
import image from './image';
import member from './member';
import setting from './setting';
import table from './table';
import template from './template';

export default [...home, ...dashboard, ...demos, ...externaLink, ...account, ...adminAccount, ...member, ...gamesetting, ...table, ...distAcct, ...chatroom, ...image, ...setting, ...template];
