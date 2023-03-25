import { FC, useEffect, useState } from 'react';
import GlobalContext from '@contexts/global';
import {
  defaultModel,
  globalConfigLocalKey,
  localConversationKey,
} from '@configs';
import type { Conversation, GlobalConfig, Lang, Message } from '@interfaces';
import type { I18n } from '@utils/i18n';
import { Tooltip } from 'antd';
import MessageBox from './MessageBox';
import MessageInput from './MessageInput';
import GlobalConfigs from './GlobalConfigs';
import ClearMessages from './ClearMessages';
import ConversationTabs from './ConversationTabs';

const defaultConversation = {
  id: '1',
  messages: [],
  createdAt: Date.now(),
};

const Main: FC<{ i18n: I18n; lang: Lang }> = ({ i18n, lang }) => {
  // input text
  const [text, setText] = useState('');

  // chat informations
  const [currentTab, setCurrentTab] = useState<string>('1');
  const [conversations, setConversations] = useState<
    Record<string, Conversation>
  >({
    [defaultConversation.id]: {
      ...defaultConversation,
      title: i18n.status_empty,
    },
  });

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // gloabl configs
  const [configs, setConfigs] = useState<GlobalConfig>({
    openAIApiKey: '',
    model: defaultModel,
    save: false,
  });

  // prompt
  const [showPrompt, setShowPrompt] = useState(false);

  const tabs = Object.values(conversations).map((conversation) => ({
    label: conversation.title,
    key: conversation.id,
  }));
  const currentMessages = conversations[currentTab]?.messages ?? [];

  useEffect(() => {
    // read from localstorage in the first time
    const localConfigsStr = localStorage.getItem(globalConfigLocalKey);
    if (localConfigsStr) {
      try {
        const localConfigs = JSON.parse(localConfigsStr);
        setConfigs(localConfigs);
        if (localConfigs.save) {
          const localConversation = localStorage.getItem(localConversationKey);
          if (localConversation) {
            const conversation = JSON.parse(localConversation);
            setConversations(conversation);
            setCurrentTab(
              Object.keys(conversation)?.[0] ?? defaultConversation.id
            );
          }
        }
      } catch (e) {
        //
      }
    }
  }, []);

  // save current conversation
  useEffect(() => {
    if (configs.save) {
      localStorage.setItem(localConversationKey, JSON.stringify(conversations));
    } else {
      localStorage.removeItem(localConversationKey);
    }
  }, [conversations, configs.save]);

  const updateMessages = (messages: Message[]) => {
    setConversations((msg) => ({
      ...msg,
      [currentTab]: {
        ...conversations[currentTab],
        messages,
        ...(messages.length > 0
          ? {
              title: messages[0].content,
            }
          : {}),
      },
    }));
  };

  const sendChatMessages = async (content: string) => {
    const current = currentTab;
    const input: Message[] = currentMessages.concat([
      {
        role: 'user',
        content,
      },
    ]);
    updateMessages(input);
    setText('');
    setLoadingMap((map) => ({
      ...map,
      [current]: true,
    }));
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        body: JSON.stringify({
          key: configs.openAIApiKey,
          model: configs.model,
          messages: input,
        }),
      });
      const data = await res.json();
      if (res.status < 400) {
        const replay = data.choices[0].message;
        updateMessages(input.concat(replay));
      } else {
        updateMessages(
          input.concat([
            { role: 'assistant', content: `Error: ${data.msg || 'Unknown'}` },
          ])
        );
      }
    } catch (e) {
      updateMessages(input.concat([{ role: 'assistant', content: 'Error' }]));
    }
    setLoadingMap((map) => ({
      ...map,
      [current]: false,
    }));
  };

  return (
    <GlobalContext.Provider value={{ i18n, lang }}>
      <header>
        <div className="flex items-center justify-between">
          <div className="title">
            <span className="text-gradient">ChatGPT</span>
          </div>
          <GlobalConfigs configs={configs} setConfigs={setConfigs} />
        </div>
        <ConversationTabs
          tabs={tabs}
          setConversations={setConversations}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
        />
      </header>
      <MessageBox messages={currentMessages} loading={loadingMap[currentTab]} />
      <footer>
        <MessageInput
          text={text}
          setText={setText}
          showPrompt={showPrompt}
          setShowPrompt={setShowPrompt}
          onSubmit={sendChatMessages}
          loading={loadingMap[currentTab]}
        />
        <div className="flex items-center justify-between pr-8">
          <Tooltip title={i18n.action_prompt}>
            <div
              className="flex items-center cursor-pointer p-1 text-gray-500"
              onClick={() => {
                setText('/');
                setShowPrompt(true);
              }}
            >
              <i className="ri-user-voice-line" />
            </div>
          </Tooltip>
          <ClearMessages onClear={() => setConversations({})} />
        </div>
      </footer>
    </GlobalContext.Provider>
  );
};

export default Main;